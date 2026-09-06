from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.planner import (
    AgentPlan,
    MAX_TOOL_STEPS,
)
from app.tools.registry import tool_registry


@dataclass
class ToolExecutionRecord:
    step_id: str
    tool_name: str
    status: str
    arguments: dict[str, Any]
    result: dict[str, Any] | None = None
    error: str | None = None


@dataclass
class AgentExecutionResult:
    records: list[ToolExecutionRecord] = field(
        default_factory=list
    )
    document_matches: list[dict] = field(
        default_factory=list
    )
    tool_context: str = ""
    failure_context: str = ""
    document_search_requested: bool = False


class ToolOrchestrator:
    def execute(
        self,
        plan: AgentPlan,
        db: Session,
        user: User,
    ) -> AgentExecutionResult:
        execution = AgentExecutionResult()

        if not plan.uses_tools:
            return execution

        context_sections = []
        failure_sections = []

        steps = plan.steps[
            :MAX_TOOL_STEPS
        ]

        for index, step in enumerate(
            steps,
            start=1,
        ):
            print(
                f"AGENT STEP {index}/{len(steps)}:",
                step.tool_name,
                "| arguments=",
                step.arguments,
            )

            if (
                step.tool_name
                == "document_search"
            ):
                execution.document_search_requested = (
                    True
                )

            try:
                result = tool_registry.execute(
                    tool_name=step.tool_name,
                    arguments=step.arguments,
                    db=db,
                    user=user,
                )

                record = ToolExecutionRecord(
                    step_id=step.step_id,
                    tool_name=step.tool_name,
                    status="completed",
                    arguments=step.arguments,
                    result=result,
                )

                execution.records.append(
                    record
                )

                print(
                    "AGENT STEP COMPLETED:",
                    step.step_id,
                    "| tool=",
                    step.tool_name,
                )

                if (
                    step.tool_name
                    == "document_search"
                ):
                    execution.document_matches.extend(
                        result.get(
                            "matches",
                            [],
                        )
                    )

                else:
                    context = (
                        self._build_result_context(
                            index=index,
                            tool_name=(
                                step.tool_name
                            ),
                            result=result,
                        )
                    )

                    if context:
                        context_sections.append(
                            context
                        )

            except Exception as exc:
                error_text = str(exc)

                execution.records.append(
                    ToolExecutionRecord(
                        step_id=step.step_id,
                        tool_name=step.tool_name,
                        status="failed",
                        arguments=step.arguments,
                        error=error_text,
                    )
                )

                print(
                    "AGENT STEP FAILED:",
                    step.step_id,
                    "| tool=",
                    step.tool_name,
                    "| error=",
                    error_text,
                )

                failure_sections.append(
                    (
                        f"- {step.tool_name}: "
                        "execution failed. "
                        "Do not invent a result for this step."
                    )
                )

        execution.document_matches = (
            self._deduplicate_document_matches(
                execution.document_matches
            )
        )

        if context_sections:
            execution.tool_context = (
                "VERIFIED FACTS FOR THIS RESPONSE:\n"
                + "\n".join(
                    context_sections
                )
            )

        if failure_sections:
            execution.failure_context = (
                "TOOL EXECUTION STATUS:\n"
                + "\n".join(
                    failure_sections
                )
            )

        print(
            "AGENT EXECUTION SUMMARY:",
            f"{len(execution.records)} step(s)",
            "| completed=",
            sum(
                1
                for record
                in execution.records
                if record.status
                == "completed"
            ),
            "| failed=",
            sum(
                1
                for record
                in execution.records
                if record.status
                == "failed"
            ),
        )

        return execution

    def _build_result_context(
        self,
        index: int,
        tool_name: str,
        result: dict[str, Any],
    ) -> str:
        if tool_name == "calculator":
            return (
                "- Verified calculation: "
                f"{result.get('expression')} = "
                f"{result.get('result')}"
            )

        if tool_name == "date_time":
            return (
                "- Verified current date/time: "
                f"{result.get('weekday')}, "
                f"{result.get('date')} "
                f"{result.get('time')} "
                f"({result.get('timezone')})"
            )

        return (
            "- Verified external result: "
            f"{result}"
        )

    def _deduplicate_document_matches(
        self,
        matches: list[dict],
    ) -> list[dict]:
        unique_matches = []
        seen_keys = set()

        for match in matches:
            key = (
                match.get(
                    "chunk_id"
                )
                or (
                    match.get(
                        "document_id"
                    ),
                    match.get(
                        "page_number"
                    ),
                    match.get(
                        "chunk_index"
                    ),
                )
            )

            if key in seen_keys:
                continue

            seen_keys.add(
                key
            )

            unique_matches.append(
                match
            )

        unique_matches.sort(
            key=lambda item: (
                item.get(
                    "similarity",
                    0.0,
                )
            ),
            reverse=True,
        )

        return unique_matches[:10]


tool_orchestrator = ToolOrchestrator()
