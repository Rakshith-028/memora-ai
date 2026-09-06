from typing import Any

from sqlalchemy.orm import Session

from app.models.user import User
from app.tools.calculator import (
    calculator_tool,
)
from app.tools.datetime_tool import (
    date_time_tool,
)
from app.tools.document_search_tool import (
    document_search_tool,
)
from app.tools.task_tool import (
    task_tool,
)


class ToolRegistry:
    def list_tools(
        self,
    ) -> list[dict]:
        return [
            {
                "name": "calculator",
                "description": (
                    calculator_tool.description
                ),
                "arguments": {
                    "expression": "string",
                },
            },
            {
                "name": "date_time",
                "description": (
                    date_time_tool.description
                ),
                "arguments": {
                    "timezone": (
                        "string, optional"
                    ),
                },
            },
            {
                "name": "document_search",
                "description": (
                    document_search_tool
                    .description
                ),
                "arguments": {
                    "query": "string",
                    "limit": (
                        "integer, optional"
                    ),
                    "document_id": (
                        "string, optional"
                    ),
                },
            },
            {
                "name": "task_manager",
                "description": (
                    task_tool.description
                ),
                "arguments": {
                    "action": (
                        "create | list | get | "
                        "update | complete | delete"
                    ),
                    "task_id": (
                        "UUID string, required for "
                        "get/update/complete/delete"
                    ),
                    "title": (
                        "string, required for create"
                    ),
                    "description": (
                        "string, optional"
                    ),
                    "status": (
                        "pending | in_progress | "
                        "completed, optional"
                    ),
                    "priority": (
                        "low | medium | high, optional"
                    ),
                    "due_at": (
                        "ISO-8601 datetime string "
                        "or null, optional"
                    ),
                    "source_conversation_id": (
                        "UUID string or null, optional"
                    ),
                },
            },
        ]

    def execute(
        self,
        tool_name: str,
        arguments: dict[
            str,
            Any
        ],
        db: Session,
        user: User,
    ) -> dict:
        if tool_name == "calculator":
            expression = arguments.get(
                "expression"
            )

            if not isinstance(
                expression,
                str,
            ):
                raise ValueError(
                    "Calculator requires "
                    "'expression'."
                )

            return (
                calculator_tool.execute(
                    expression=expression
                )
            )

        if tool_name == "date_time":
            timezone = arguments.get(
                "timezone",
                "UTC",
            )

            if not isinstance(
                timezone,
                str,
            ):
                raise ValueError(
                    "Timezone must be a string."
                )

            return (
                date_time_tool.execute(
                    timezone=timezone
                )
            )

        if tool_name == "document_search":
            query = arguments.get(
                "query"
            )

            if not isinstance(
                query,
                str,
            ):
                raise ValueError(
                    "Document search requires "
                    "'query'."
                )

            limit = arguments.get(
                "limit",
                5,
            )

            document_id = (
                arguments.get(
                    "document_id"
                )
            )

            return (
                document_search_tool.execute(
                    db=db,
                    user=user,
                    query=query,
                    limit=limit,
                    document_id=document_id,
                )
            )

        if tool_name == "task_manager":
            action = arguments.get(
                "action"
            )

            if not isinstance(
                action,
                str,
            ):
                raise ValueError(
                    "Task manager requires "
                    "'action'."
                )

            task_arguments = {
                key: value
                for key, value
                in arguments.items()
                if key != "action"
            }

            return task_tool.execute(
                db=db,
                user=user,
                action=action,
                **task_arguments,
            )

        raise KeyError(
            f"Unknown tool: {tool_name}"
        )


tool_registry = ToolRegistry()