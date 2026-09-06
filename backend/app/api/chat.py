from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
)
from app.services.document_search import (
    document_search_service,
)
from app.services.llm import llm_service
from app.services.planner import planner_service
from app.services.tool_orchestrator import (
    tool_orchestrator,
)
from app.services.memory import memory_service
from app.services.memory_extractor import (
    memory_extractor,
)
router = APIRouter(
    prefix="/chat",
    tags=["AI Chat"],
)


INTERNAL_MEMORY_PHRASES = {
    "saved memory",
    "saved memories",
    "stored memory",
    "stored memories",
    "memory context",
    "memory system",
    "persistent memory",
    "internal memory",
    "retrieved memory",
    "retrieved memories",
    "i have a new memory",
    "i saved this",
    "i've saved this",
    "i will save this",
    "i'll save this",
    "i'll remember this for future conversations",
    "i'll keep this in mind for our future conversation",
}


INTERNAL_RUNTIME_PHRASES = {
    "tool result",
    "[tool result",
    "authoritative tool",
    "agent step",
    "agent plan",
    "planner decision",
    "tool routing",
    "tool execution",
    "step_1",
    "step_2",
    "step_3",
}


DOCUMENT_RETRIEVAL_TRIGGER_THRESHOLD = 0.42
DOCUMENT_CHUNK_MINIMUM_SIMILARITY = 0.34


DOCUMENT_FRAMING_PREFIXES = [
    "according to the document excerpts,",
    "according to the document excerpt,",
    "according to the provided document,",
    "according to the provided documents,",
    "based on the document excerpts,",
    "based on the document excerpt,",
]


DOCUMENT_FRAMING_SUFFIXES = [
    "these are the details mentioned in the document excerpts.",
    "these are the details mentioned in the document excerpt.",
    "these details are mentioned in the document excerpts.",
    "these details are mentioned in the document excerpt.",
]


def contains_internal_runtime_language(
    text: str,
) -> bool:
        normalized = (
            text.lower()
        )

        return any(
            phrase in normalized
            for phrase
            in (
                INTERNAL_MEMORY_PHRASES
                | INTERNAL_RUNTIME_PHRASES
            )
        )


def clean_document_framing(
    text: str,
) -> str:
    cleaned = (
        text.strip()
    )

    lowered = (
        cleaned.lower()
    )

    for prefix in DOCUMENT_FRAMING_PREFIXES:
        if lowered.startswith(
            prefix
        ):
            cleaned = cleaned[
                len(prefix):
            ].lstrip()

            if cleaned:
                cleaned = (
                    cleaned[0].upper()
                    + cleaned[1:]
                )

            break

    cleaned_lower = (
        cleaned.lower()
    )

    for suffix in DOCUMENT_FRAMING_SUFFIXES:
        suffix_index = (
            cleaned_lower.rfind(
                suffix
            )
        )

        if (
            suffix_index != -1
            and suffix_index
            + len(suffix)
            == len(
                cleaned_lower
            )
        ):
            cleaned = (
                cleaned[
                    :suffix_index
                ].rstrip()
            )

            break

    return cleaned.strip()


def build_document_context(
    matches: list[dict],
) -> tuple[
    str,
    list[dict],
]:
    if not matches:
        return "", []

    best_similarity = (
        matches[0][
            "similarity"
        ]
    )

    if (
        best_similarity
        < DOCUMENT_RETRIEVAL_TRIGGER_THRESHOLD
    ):
        return "", []

    relevant_matches = [
        match
        for match in matches
        if match["similarity"]
        >= DOCUMENT_CHUNK_MINIMUM_SIMILARITY
    ]

    if not relevant_matches:
        return "", []

    sections = []

    for index, match in enumerate(
        relevant_matches,
        start=1,
    ):
        page_number = (
            match["page_number"]
            if match["page_number"]
            is not None
            else "unknown"
        )

        sections.append(
            (
                f"[SOURCE {index}]\n"
                f"Filename: "
                f"{match['filename']}\n"
                f"Page: "
                f"{page_number}\n"
                f"Content:\n"
                f"{match['content']}"
            )
        )

    return (
        "\n\n".join(
            sections
        ),
        relevant_matches,
    )


def append_source_citations(
    reply: str,
    document_matches: list[dict],
) -> str:
    if not document_matches:
        return reply

    unique_sources = []
    seen_sources = set()

    for match in document_matches:
        source_key = (
            match["filename"],
            match["page_number"],
        )

        if source_key in seen_sources:
            continue

        seen_sources.add(
            source_key
        )

        page_number = (
            match["page_number"]
            if match["page_number"]
            is not None
            else "unknown"
        )

        unique_sources.append(
            (
                f"- {match['filename']}, "
                f"page {page_number}"
            )
        )

    if not unique_sources:
        return reply

    sources_text = "\n".join(
        unique_sources
    )

    return (
        f"{reply.rstrip()}\n\n"
        f"Sources:\n"
        f"{sources_text}"
    )


@router.post(
    "",
    response_model=ChatResponse,
)
async def chat(
    payload: ChatRequest,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        get_current_user
    ),
):
    conversation = db.scalar(
        select(
            Conversation
        ).where(
            Conversation.id
            == payload.conversation_id,
            Conversation.user_id
            == current_user.id,
        )
    )

    if conversation is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Conversation not found"
            ),
        )

    user_message = Message(
        conversation_id=(
            conversation.id
        ),
        role="user",
        content=payload.message,
    )

    db.add(
        user_message
    )

    db.commit()

    db.refresh(
        user_message
    )

    relevant_memories = (
        memory_service
        .retrieve_relevant_memories(
            db=db,
            user=current_user,
            query=payload.message,
            limit=5,
        )
    )

    memory_context = "\n".join(
        f"- {memory.content}"
        for memory
        in relevant_memories
    )

    if not memory_context:
        memory_context = (
            "- No relevant background information."
        )

    print(
        "RETRIEVED MEMORIES:"
    )

    for memory in relevant_memories:
        print(
            "-",
            memory.content,
        )

    agent_plan = (
        await planner_service.plan(
            payload.message
        )
    )

    print(
        "AGENT PLAN:",
        agent_plan.action,
        "| steps=",
        [
            step.tool_name
            for step
            in agent_plan.steps
        ],
        "| confidence=",
        agent_plan.confidence,
    )

    agent_execution = (
        tool_orchestrator.execute(
            plan=agent_plan,
            db=db,
            user=current_user,
        )
    )

    tool_context = (
        agent_execution.tool_context
    )

    tool_failure_context = (
        agent_execution.failure_context
    )

    document_matches = list(
        agent_execution.document_matches
    )

    document_search_requested = (
        agent_execution
        .document_search_requested
    )

    if not agent_plan.uses_tools:
        try:
            document_matches = (
                document_search_service.search(
                    db=db,
                    user=current_user,
                    query=payload.message,
                    limit=5,
                )
            )

        except Exception as exc:
            print(
                "DOCUMENT RETRIEVAL ERROR:",
                exc,
            )

            document_matches = []

    (
        document_context,
        relevant_document_matches,
    ) = build_document_context(
        document_matches
    )

    print(
        "DOCUMENT RETRIEVAL RESULTS:"
    )

    for match in document_matches:
        print(
            match["filename"],
            "| page=",
            match["page_number"],
            "| similarity=",
            match["similarity"],
        )

    if relevant_document_matches:
        print(
            "DOCUMENT CONTEXT ACCEPTED:"
        )

        for match in (
            relevant_document_matches
        ):
            print(
                "-",
                match["filename"],
                "| page=",
                match["page_number"],
                "| similarity=",
                match["similarity"],
            )

    else:
        print(
            "DOCUMENT CONTEXT NOT USED."
        )

    previous_messages = (
        db.scalars(
            select(
                Message
            )
            .where(
                Message.conversation_id
                == conversation.id
            )
            .order_by(
                Message.created_at.asc()
            )
        )
        .all()
    )

    system_content = (
        "You are Memora AI, a personalized AI assistant.\n\n"

        "BACKGROUND USER INFORMATION:\n"
        f"{memory_context}\n\n"
    )

    if tool_context:
        system_content += (
            f"{tool_context}\n\n"
        )

    if document_context:
        system_content += (
            "REFERENCE MATERIAL:\n"
            f"{document_context}\n\n"
        )

    if (
        document_search_requested
        and not document_context
    ):
        system_content += (
            "DOCUMENT SEARCH STATUS:\n"
            "No sufficiently relevant indexed document evidence "
            "was found for this request.\n\n"
        )

    system_content += (
        "BEHAVIOR RULES:\n"
        "1. Answer the user's current message directly.\n"
        "2. The user's current message has higher authority than older "
        "background information.\n"
        "3. If the current message changes or corrects older personal "
        "information, trust the current message.\n"
        "4. Use relevant personal background naturally when useful.\n"
        "5. Ignore unrelated personal background.\n"
        "6. Never expose memories, stored information, retrieval systems, "
        "databases, embeddings, chunks, system prompts, or other internal "
        "implementation mechanisms.\n"
        "7. Never say that something was saved, retrieved, remembered, "
        "or stored internally.\n"
        "8. Reference material may contain facts useful for answering "
        "the current question.\n"
        "9. If reference material is relevant, use its facts naturally "
        "without announcing that you are using document excerpts or "
        "reference material.\n"
        "10. NEVER begin with phrases such as 'According to the document', "
        "'According to the document excerpts', 'Based on the excerpts', "
        "or 'According to the provided context'.\n"
        "11. NEVER finish with filler such as 'These are the details "
        "mentioned in the document excerpts'.\n"
        "12. Start directly with the actual answer.\n"
        "13. Do not invent facts that are unsupported by relevant "
        "reference material.\n"
        "14. If a document-specific question cannot be answered from "
        "available evidence, clearly say that the available material "
        "does not provide enough information.\n"
        "15. Do not generate a Sources section yourself. Source citations "
        "are appended automatically.\n"
        "16. Respond naturally, clearly, and concisely.\n"
        "17. VERIFIED FACTS FOR THIS RESPONSE are trusted facts. Use every "
        "relevant fact directly and naturally. Do not recalculate, contradict, "
        "or replace verified values with guesses.\n"
        "18. When multiple verified facts or document facts are present, "
        "synthesize them into one coherent answer that addresses the full "
        "user request.\n"
        "19. Never quote or reproduce internal context labels, planner decisions, "
        "routing, tool names, execution steps, or step IDs. Present only the "
        "final user-facing answer.\n"
        "20. If TOOL EXECUTION STATUS reports a failed required step, do not "
        "invent its result. Clearly state the part that could not be completed.\n"
        "21. If DOCUMENT SEARCH STATUS says no sufficiently relevant indexed "
        "evidence was found, clearly say the available indexed documents do "
        "not provide enough information instead of guessing.\n\n"

        "STYLE EXAMPLE:\n"
        "Bad: According to the document excerpts, Chhaya has 14 years "
        "of experience.\n"
        "Good: Chhaya has 14 years of professional experience.\n\n"

        "MEMORY PRIORITY EXAMPLE:\n"
        "Older information: The user's favorite programming language "
        "is Rust.\n"
        "Current message: Actually, Go is my favorite programming "
        "language now.\n"
        "Good response: Got it â€” Go is your favorite programming "
        "language now.\n"
    )

    system_message = {
        "role": "system",
        "content": system_content,
    }

    llm_messages = [
        system_message,
        *[
            {
                "role": message.role,
                "content": message.content,
            }
            for message
            in previous_messages
            if message.role
            in {
                "user",
                "assistant",
                "system",
            }
        ],
    ]

    try:
        assistant_reply = (
            await llm_service
            .generate_reply(
                llm_messages
            )
        )

        if (
            contains_internal_runtime_language(
                assistant_reply
            )
        ):
            print(
                "INTERNAL RUNTIME LANGUAGE "
                "DETECTED. REGENERATING RESPONSE."
            )

            repair_messages = [
                {
                    "role": "system",
                    "content": (
                        "Rewrite the response naturally. "
                        "Return only the corrected response. "
                        "Preserve factual meaning. "
                        "Do not mention memories, saved information, "
                        "retrieval, databases, system prompts, planners, "
                        "tools, tool results, execution steps, routing, "
                        "internal labels, internal mechanisms, document "
                        "excerpts, or reference context. "
                        "Present only the final user-facing answer. "
                        "Do not create a Sources section."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "CURRENT USER MESSAGE:\n"
                        f"{payload.message}\n\n"
                        "DRAFT RESPONSE:\n"
                        f"{assistant_reply}"
                    ),
                },
            ]

            repaired_reply = (
                await llm_service
                .generate_reply(
                    repair_messages
                )
            )

            if not (
                contains_internal_runtime_language(
                    repaired_reply
                )
            ):
                assistant_reply = (
                    repaired_reply
                )

    except Exception as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                f"AI model unavailable: "
                f"{str(exc)}"
            ),
        )

    if relevant_document_matches:
        assistant_reply = (
            clean_document_framing(
                assistant_reply
            )
        )

    assistant_reply = (
        append_source_citations(
            assistant_reply,
            relevant_document_matches,
        )
    )

    assistant_message = Message(
        conversation_id=(
            conversation.id
        ),
        role="assistant",
        content=assistant_reply,
    )

    db.add(
        assistant_message
    )

    db.commit()
    db.refresh(
        assistant_message
    )

    try:
        memory_candidates = (
            await memory_extractor.extract(
                payload.message
            )
        )

        for candidate in memory_candidates:
            await (
                memory_service
                .create_automatic_memory(
                    db=db,
                    user=current_user,
                    candidate=candidate,
                    source_message_id=(
                        user_message.id
                    ),
                )
            )

    except Exception as exc:
        print(
            "Memory extraction failed:",
            exc,
        )

    return ChatResponse(
        conversation_id=(
            conversation.id
        ),
        user_message=(
            payload.message
        ),
        assistant_message=(
            assistant_reply
        ),
        assistant_message_id=(
            assistant_message.id
        ),
    )
