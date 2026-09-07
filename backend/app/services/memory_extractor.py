import json
import re

from app.services.llm import llm_service


class MemoryExtractor:
    EXPLICIT_MEMORY_PATTERNS = (
        r"\bremember that\b",
        r"\bremember this\b",
        r"\bdon't forget\b",
        r"\bdo not forget\b",
        r"\bkeep this in mind\b",
        r"\bsave this\b",
        r"\bstore this\b",
    )

    SELF_DISCLOSURE_PATTERNS = (
        r"\bi am\b",
        r"\bi'm\b",
        r"\bi have\b",
        r"\bi've\b",
        r"\bi use\b",
        r"\bi prefer\b",
        r"\bi like\b",
        r"\bi love\b",
        r"\bi hate\b",
        r"\bi want\b",
        r"\bi plan\b",
        r"\bi work\b",
        r"\bi study\b",
        r"\bi live\b",
        r"\bi moved\b",
        r"\bi finished\b",
        r"\bi started\b",
        r"\bi switched\b",
        r"\bi changed\b",
        r"\bi chose\b",
        r"\bi decided\b",
        r"\bi usually\b",
        r"\bi always\b",
        r"\bi often\b",
        r"\bi mostly\b",
        r"\bi primarily\b",
        r"\bmy favorite\b",
        r"\bmy favourite\b",
        r"\bmy goal\b",
        r"\bmy plan\b",
        r"\bmy project\b",
        r"\bmy job\b",
        r"\bmy work\b",
        r"\bmy college\b",
        r"\bmy university\b",
        r"\bmy course\b",
        r"\bmy degree\b",
        r"\bmy city\b",
        r"\bmy preference\b",
        r"\bmy workflow\b",
        r"\bmy editor\b",
        r"\bmy current\b",
    )

    REJECTED_CANDIDATE_PHRASES = (
        "not explicitly stated",
        "not stated",
        "not provided",
        "not specified",
        "unknown",
        "cannot be determined",
        "can't be determined",
        "unclear",
        "the user asked",
        "the user asks",
        "the user is asking",
        "the user requested",
        "the user wants to know",
        "the user wants an explanation",
    )

    async def extract(
        self,
        user_message: str,
    ) -> list[dict]:
        if not self._should_attempt_extraction(
            user_message
        ):
            print(
                "MEMORY EXTRACTION SKIPPED: "
                "no explicit persistent user information."
            )
            return []

        system_prompt = """
You are the memory extraction component of a personalized AI assistant.

Your job is to extract ONLY useful user information that should be remembered
across future conversations.

Extract memories only when the user explicitly reveals information about themselves.

GOOD MEMORIES INCLUDE:

- preferences
- favorite things
- stable personal facts
- long-term goals
- ongoing projects
- skills
- recurring habits
- important decisions
- long-term plans
- preferred tools
- preferred technologies
- preferred styles
- preferred workflows
- current long-lived states that are useful later

DO NOT SAVE:

- greetings
- temporary questions
- questions about the user's existing preferences
- requests for information
- requests for explanations
- requests for coding help
- definitions or general-knowledge facts
- facts learned from the assistant's answer
- random facts
- assistant instructions
- incomplete phrases
- generic topic labels
- information unlikely to matter later
- information only implied rather than explicitly stated
- questions
- speculative statements
- inferred emotional or psychological states
- missing/unknown information about the user
- facts about other people unless they are directly relevant to the user's own persistent context

CRITICAL GROUNDING RULE

A memory must be directly supported by something the USER explicitly said
about themselves in the current message.

Never convert the topic of a request into a user fact.

Examples:

User:
"Explain binary search in simple words."

Return:
{
  "memories": []
}

User:
"What is recursion?"

Return:
{
  "memories": []
}

User:
"Tell me about neural networks."

Return:
{
  "memories": []
}

User:
"Explain Python loops."

Return:
{
  "memories": []
}

User:
"I am learning Python. Explain loops to me."

Return:
{
  "memories": [
    {
      "content": "The user is currently learning Python.",
      "memory_type": "semantic",
      "importance_score": 0.7,
      "confidence_score": 0.95
    }
  ]
}

VERY IMPORTANT QUESTION RULE

A question must NOT become a memory simply because it contains personal words.

Example:

User:
"What programming language do I like?"

Return:
{
  "memories": []
}

User:
"Do I prefer dark mode?"

Return:
{
  "memories": []
}

CANONICAL MEMORY RULE

Write memories as the user's CURRENT STATE.

Do not unnecessarily preserve transition wording such as:

- instead of
- over
- previously
- used to
- changed from
- switched from

when the important persistent fact is simply the user's new current state.

The stored memory should be concise, stable, and easy to compare with future memories.

PRESERVE THE UNDERLYING ATTRIBUTE

Never remove the attribute that explains what the value represents.

BAD:
"The user prefers Rust over Java."

GOOD:
"The user's favorite programming language is Rust."

BAD:
"The user prefers light over dark."

GOOD:
"The user prefers light mode."

BAD:
"The user now prefers Next.js over React."

If the user was talking about the framework they are currently learning, use:
"The user is currently learning Next.js."

SINGLE-VALUED CURRENT ATTRIBUTES

For attributes that normally have one current value, store only the latest current value.

Examples:

- favorite programming language
- current city
- current job
- preferred UI theme
- current technology being learned
- current primary project
- preferred framework
- preferred editor

If the user explicitly updates one of these, extract the NEW CURRENT STATE.

EXAMPLES

Example 1

User:
"I prefer Python over Java."

Return:
{
  "memories": [
    {
      "content": "The user prefers Python.",
      "memory_type": "preference",
      "importance_score": 0.8,
      "confidence_score": 0.95
    }
  ]
}

Example 2

User:
"Python is my favorite programming language."

Return:
{
  "memories": [
    {
      "content": "The user's favorite programming language is Python.",
      "memory_type": "preference",
      "importance_score": 0.8,
      "confidence_score": 0.95
    }
  ]
}

Example 3

User:
"Actually, Java is my favorite programming language now instead of Python."

Return:
{
  "memories": [
    {
      "content": "The user's favorite programming language is Java.",
      "memory_type": "preference",
      "importance_score": 0.8,
      "confidence_score": 0.95
    }
  ]
}

Example 4

User:
"Actually, Rust is my favorite programming language now instead of C++."

Return:
{
  "memories": [
    {
      "content": "The user's favorite programming language is Rust.",
      "memory_type": "preference",
      "importance_score": 0.8,
      "confidence_score": 0.95
    }
  ]
}

Example 5

User:
"I prefer dark mode."

Return:
{
  "memories": [
    {
      "content": "The user prefers dark mode.",
      "memory_type": "preference",
      "importance_score": 0.8,
      "confidence_score": 0.95
    }
  ]
}

Example 6

User:
"I now prefer light mode instead of dark mode."

Return:
{
  "memories": [
    {
      "content": "The user prefers light mode.",
      "memory_type": "preference",
      "importance_score": 0.8,
      "confidence_score": 0.95
    }
  ]
}

Example 7

User:
"I moved from Delhi to Mumbai."

Return:
{
  "memories": [
    {
      "content": "The user currently lives in Mumbai.",
      "memory_type": "semantic",
      "importance_score": 0.8,
      "confidence_score": 0.95
    }
  ]
}

Example 8

User:
"I am currently building an AI agent project."

Return:
{
  "memories": [
    {
      "content": "The user is currently building an AI agent project.",
      "memory_type": "semantic",
      "importance_score": 0.7,
      "confidence_score": 0.95
    }
  ]
}

Example 9

User:
"I finished learning React and now I am learning Next.js."

Return:
{
  "memories": [
    {
      "content": "The user is currently learning Next.js.",
      "memory_type": "semantic",
      "importance_score": 0.7,
      "confidence_score": 0.95
    }
  ]
}

Example 10

User:
"I use VS Code for most of my programming."

Return:
{
  "memories": [
    {
      "content": "The user primarily uses VS Code for programming.",
      "memory_type": "preference",
      "importance_score": 0.7,
      "confidence_score": 0.95
    }
  ]
}

Example 11

User:
"What is Python?"

Return:
{
  "memories": []
}

Example 12

User:
"What programming language do I like?"

Return:
{
  "memories": []
}

Example 13

User:
"Should I learn Rust?"

Return:
{
  "memories": []
}

MEMORY QUALITY RULES

Every memory should:

1. describe a concrete fact about the user
2. be directly supported by the current user message
3. be understandable without reading the original message
4. preserve the underlying attribute
5. represent the user's latest/current state when applicable
6. avoid unnecessary historical wording
7. be concise
8. be written in third person
9. start with "The user" or "The user's"
10. avoid vague phrases such as:
   - "The user likes technology"
   - "The user has preferences"
   - "The user likes programming"

ALLOWED MEMORY TYPES

- semantic
- episodic
- preference
- goal
- procedural

OUTPUT RULES

Return ONLY valid JSON.

Do not return markdown.
Do not return explanations.
Do not return text outside the JSON.

Use exactly this structure:

{
  "memories": [
    {
      "content": "Concise canonical memory written in third person.",
      "memory_type": "preference",
      "importance_score": 0.8,
      "confidence_score": 0.9
    }
  ]
}

If nothing should be remembered, return:

{
  "memories": []
}
"""

        content = await llm_service.generate_reply(
            [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_message,
                },
            ],
            temperature=0.0,
            json_mode=True,
        )

        try:
            parsed = json.loads(
                content
            )

            memories = parsed.get(
                "memories",
                [],
            )

            if not isinstance(
                memories,
                list,
            ):
                return []

            valid_memories = []

            allowed_types = {
                "semantic",
                "episodic",
                "preference",
                "goal",
                "procedural",
            }

            for memory in memories:
                if not isinstance(
                    memory,
                    dict,
                ):
                    continue

                memory_content = memory.get(
                    "content"
                )

                memory_type = memory.get(
                    "memory_type"
                )

                if not isinstance(
                    memory_content,
                    str,
                ):
                    continue

                memory_content = (
                    memory_content.strip()
                )

                if not self._is_grounded_candidate(
                    memory_content
                ):
                    print(
                        "REJECTED UNGROUNDED "
                        "MEMORY CANDIDATE:",
                        memory_content,
                    )
                    continue

                if memory_type not in allowed_types:
                    continue

                try:
                    importance_score = float(
                        memory.get(
                            "importance_score",
                            0.5,
                        )
                    )
                except (
                    TypeError,
                    ValueError,
                ):
                    importance_score = 0.5

                try:
                    confidence_score = float(
                        memory.get(
                            "confidence_score",
                            0.7,
                        )
                    )
                except (
                    TypeError,
                    ValueError,
                ):
                    confidence_score = 0.7

                importance_score = max(
                    0.0,
                    min(
                        1.0,
                        importance_score,
                    ),
                )

                confidence_score = max(
                    0.0,
                    min(
                        1.0,
                        confidence_score,
                    ),
                )

                if confidence_score < 0.65:
                    print(
                        "REJECTED LOW-CONFIDENCE "
                        "MEMORY CANDIDATE:",
                        memory_content,
                    )
                    continue

                valid_memories.append(
                    {
                        "content": memory_content,
                        "memory_type": memory_type,
                        "importance_score": (
                            importance_score
                        ),
                        "confidence_score": (
                            confidence_score
                        ),
                    }
                )

            return valid_memories

        except (
            json.JSONDecodeError,
            TypeError,
            KeyError,
        ) as exc:
            print(
                "MEMORY EXTRACTION PARSE ERROR:",
                exc,
            )

            return []

    def _should_attempt_extraction(
        self,
        user_message: str,
    ) -> bool:
        normalized = (
            user_message
            .strip()
            .lower()
        )

        if not normalized:
            return False

        if any(
            re.search(
                pattern,
                normalized,
            )
            for pattern
            in self.EXPLICIT_MEMORY_PATTERNS
        ):
            return True

        if any(
            re.search(
                pattern,
                normalized,
            )
            for pattern
            in self.SELF_DISCLOSURE_PATTERNS
        ):
            return True

        return False

    def _is_grounded_candidate(
        self,
        content: str,
    ) -> bool:
        cleaned = content.strip()
        lowered = cleaned.lower()

        if not (
            lowered.startswith(
                "the user "
            )
            or lowered.startswith(
                "the user's "
            )
        ):
            return False

        if any(
            phrase in lowered
            for phrase
            in self.REJECTED_CANDIDATE_PHRASES
        ):
            return False

        return True


memory_extractor = MemoryExtractor()
