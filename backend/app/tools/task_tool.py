import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.task import Task
from app.models.user import User


VALID_STATUSES = {
    "pending",
    "in_progress",
    "completed",
}

VALID_PRIORITIES = {
    "low",
    "medium",
    "high",
}


class TaskTool:
    name = "task_manager"

    description = (
        "Create, list, read, update, complete, or delete "
        "the authenticated user's persistent tasks. "
        "Use this when the user asks to remember an action item, "
        "create a task, show tasks, change task status or priority, "
        "set a due date, complete a task, or delete a task."
    )

    def _serialize(
        self,
        task: Task,
    ) -> dict[str, Any]:
        return {
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "due_at": (
                task.due_at.isoformat()
                if task.due_at
                else None
            ),
            "source_conversation_id": (
                str(task.source_conversation_id)
                if task.source_conversation_id
                else None
            ),
            "created_at": (
                task.created_at.isoformat()
                if task.created_at
                else None
            ),
            "updated_at": (
                task.updated_at.isoformat()
                if task.updated_at
                else None
            ),
        }

    def _parse_uuid(
        self,
        value: Any,
        field_name: str,
    ) -> uuid.UUID:
        if isinstance(value, uuid.UUID):
            return value

        if not isinstance(value, str):
            raise ValueError(
                f"{field_name} must be a UUID string."
            )

        try:
            return uuid.UUID(value)
        except ValueError as exc:
            raise ValueError(
                f"Invalid {field_name}."
            ) from exc

    def _parse_due_at(
        self,
        value: Any,
    ) -> datetime | None:
        if value is None:
            return None

        if isinstance(value, datetime):
            return value

        if not isinstance(value, str):
            raise ValueError(
                "due_at must be an ISO-8601 datetime string."
            )

        cleaned = value.strip()

        if not cleaned:
            return None

        if cleaned.endswith("Z"):
            cleaned = (
                cleaned[:-1]
                + "+00:00"
            )

        try:
            return datetime.fromisoformat(
                cleaned
            )
        except ValueError as exc:
            raise ValueError(
                "Invalid due_at. Use ISO-8601 datetime format."
            ) from exc

    def _get_owned_task(
        self,
        db: Session,
        user: User,
        task_id: uuid.UUID,
    ) -> Task:
        task = db.scalar(
            select(Task).where(
                Task.id == task_id,
                Task.user_id == user.id,
            )
        )

        if task is None:
            raise ValueError(
                "Task not found."
            )

        return task

    def _validate_conversation(
        self,
        db: Session,
        user: User,
        conversation_id: uuid.UUID,
    ) -> None:
        conversation = db.scalar(
            select(Conversation).where(
                Conversation.id
                == conversation_id,
                Conversation.user_id
                == user.id,
            )
        )

        if conversation is None:
            raise ValueError(
                "Source conversation not found."
            )

    def _create(
        self,
        db: Session,
        user: User,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        title = arguments.get(
            "title"
        )

        if not isinstance(
            title,
            str,
        ):
            raise ValueError(
                "Creating a task requires 'title'."
            )

        title = title.strip()

        if not title:
            raise ValueError(
                "Task title cannot be empty."
            )

        if len(title) > 255:
            raise ValueError(
                "Task title cannot exceed 255 characters."
            )

        description = arguments.get(
            "description"
        )

        if description is not None:
            if not isinstance(
                description,
                str,
            ):
                raise ValueError(
                    "description must be a string."
                )

            description = (
                description.strip()
                or None
            )

            if (
                description is not None
                and len(description) > 5000
            ):
                raise ValueError(
                    "Task description cannot exceed "
                    "5000 characters."
                )

        task_status = arguments.get(
            "status",
            "pending",
        )

        if task_status not in VALID_STATUSES:
            raise ValueError(
                "status must be pending, "
                "in_progress, or completed."
            )

        priority = arguments.get(
            "priority",
            "medium",
        )

        if priority not in VALID_PRIORITIES:
            raise ValueError(
                "priority must be low, medium, or high."
            )

        due_at = self._parse_due_at(
            arguments.get(
                "due_at"
            )
        )

        source_conversation_id = None

        raw_conversation_id = arguments.get(
            "source_conversation_id"
        )

        if raw_conversation_id is not None:
            source_conversation_id = (
                self._parse_uuid(
                    raw_conversation_id,
                    "source_conversation_id",
                )
            )

            self._validate_conversation(
                db=db,
                user=user,
                conversation_id=source_conversation_id,
            )

        task = Task(
            user_id=user.id,
            source_conversation_id=source_conversation_id,
            title=title,
            description=description,
            status=task_status,
            priority=priority,
            due_at=due_at,
        )

        db.add(task)
        db.commit()
        db.refresh(task)

        return {
            "action": "created",
            "task": self._serialize(
                task
            ),
        }

    def _list(
        self,
        db: Session,
        user: User,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        task_status = arguments.get(
            "status"
        )

        priority = arguments.get(
            "priority"
        )

        if (
            task_status is not None
            and task_status
            not in VALID_STATUSES
        ):
            raise ValueError(
                "status must be pending, "
                "in_progress, or completed."
            )

        if (
            priority is not None
            and priority
            not in VALID_PRIORITIES
        ):
            raise ValueError(
                "priority must be low, medium, or high."
            )

        statement = select(Task).where(
            Task.user_id == user.id
        )

        if task_status is not None:
            statement = statement.where(
                Task.status
                == task_status
            )

        if priority is not None:
            statement = statement.where(
                Task.priority
                == priority
            )

        statement = statement.order_by(
            Task.due_at.asc().nullslast(),
            Task.created_at.desc(),
        )

        tasks = db.scalars(
            statement
        ).all()

        return {
            "action": "listed",
            "count": len(tasks),
            "tasks": [
                self._serialize(task)
                for task in tasks
            ],
        }

    def _get(
        self,
        db: Session,
        user: User,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        task_id = self._parse_uuid(
            arguments.get(
                "task_id"
            ),
            "task_id",
        )

        task = self._get_owned_task(
            db=db,
            user=user,
            task_id=task_id,
        )

        return {
            "action": "retrieved",
            "task": self._serialize(
                task
            ),
        }

    def _update(
        self,
        db: Session,
        user: User,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        task_id = self._parse_uuid(
            arguments.get(
                "task_id"
            ),
            "task_id",
        )

        task = self._get_owned_task(
            db=db,
            user=user,
            task_id=task_id,
        )

        if "title" in arguments:
            title = arguments.get(
                "title"
            )

            if not isinstance(
                title,
                str,
            ):
                raise ValueError(
                    "title must be a string."
                )

            title = title.strip()

            if not title:
                raise ValueError(
                    "Task title cannot be empty."
                )

            if len(title) > 255:
                raise ValueError(
                    "Task title cannot exceed 255 characters."
                )

            task.title = title

        if "description" in arguments:
            description = arguments.get(
                "description"
            )

            if description is None:
                task.description = None
            else:
                if not isinstance(
                    description,
                    str,
                ):
                    raise ValueError(
                        "description must be a string."
                    )

                description = (
                    description.strip()
                    or None
                )

                if (
                    description is not None
                    and len(description) > 5000
                ):
                    raise ValueError(
                        "Task description cannot exceed "
                        "5000 characters."
                    )

                task.description = (
                    description
                )

        if "status" in arguments:
            task_status = arguments.get(
                "status"
            )

            if task_status not in VALID_STATUSES:
                raise ValueError(
                    "status must be pending, "
                    "in_progress, or completed."
                )

            task.status = task_status

        if "priority" in arguments:
            priority = arguments.get(
                "priority"
            )

            if priority not in VALID_PRIORITIES:
                raise ValueError(
                    "priority must be low, medium, or high."
                )

            task.priority = priority

        if "due_at" in arguments:
            task.due_at = (
                self._parse_due_at(
                    arguments.get(
                        "due_at"
                    )
                )
            )

        if (
            "source_conversation_id"
            in arguments
        ):
            raw_conversation_id = (
                arguments.get(
                    "source_conversation_id"
                )
            )

            if raw_conversation_id is None:
                task.source_conversation_id = (
                    None
                )
            else:
                conversation_id = (
                    self._parse_uuid(
                        raw_conversation_id,
                        "source_conversation_id",
                    )
                )

                self._validate_conversation(
                    db=db,
                    user=user,
                    conversation_id=conversation_id,
                )

                task.source_conversation_id = (
                    conversation_id
                )

        db.commit()
        db.refresh(task)

        return {
            "action": "updated",
            "task": self._serialize(
                task
            ),
        }

    def _delete(
        self,
        db: Session,
        user: User,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        task_id = self._parse_uuid(
            arguments.get(
                "task_id"
            ),
            "task_id",
        )

        task = self._get_owned_task(
            db=db,
            user=user,
            task_id=task_id,
        )

        deleted_task = (
            self._serialize(
                task
            )
        )

        db.delete(task)
        db.commit()

        return {
            "action": "deleted",
            "task": deleted_task,
        }

    def execute(
        self,
        db: Session,
        user: User,
        action: str,
        **arguments: Any,
    ) -> dict[str, Any]:
        normalized_action = (
            action.strip().lower()
        )

        if normalized_action == "create":
            return self._create(
                db=db,
                user=user,
                arguments=arguments,
            )

        if normalized_action == "list":
            return self._list(
                db=db,
                user=user,
                arguments=arguments,
            )

        if normalized_action == "get":
            return self._get(
                db=db,
                user=user,
                arguments=arguments,
            )

        if normalized_action in {
            "update",
            "complete",
        }:
            if normalized_action == "complete":
                arguments["status"] = (
                    "completed"
                )

            return self._update(
                db=db,
                user=user,
                arguments=arguments,
            )

        if normalized_action == "delete":
            return self._delete(
                db=db,
                user=user,
                arguments=arguments,
            )

        raise ValueError(
            "action must be create, list, get, "
            "update, complete, or delete."
        )


task_tool = TaskTool()