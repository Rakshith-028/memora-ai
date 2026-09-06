import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.models.conversation import Conversation
from app.models.task import Task
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskPriority,
    TaskResponse,
    TaskStatus,
    TaskUpdate,
)


router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


def get_owned_task(
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return task


def validate_conversation(
    db: Session,
    user: User,
    conversation_id: uuid.UUID,
) -> None:
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
        )
    )

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source conversation not found",
        )


@router.get(
    "",
    response_model=list[TaskResponse],
)
def list_tasks(
    task_status: TaskStatus | None = Query(
        default=None,
        alias="status",
    ),
    priority: TaskPriority | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    statement = select(Task).where(
        Task.user_id == current_user.id
    )

    if task_status is not None:
        statement = statement.where(
            Task.status == task_status
        )

    if priority is not None:
        statement = statement.where(
            Task.priority == priority
        )

    statement = statement.order_by(
        Task.due_at.asc().nullslast(),
        Task.created_at.desc(),
    )

    tasks = db.scalars(statement).all()

    return list(tasks)


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    if (
        payload.source_conversation_id
        is not None
    ):
        validate_conversation(
            db=db,
            user=current_user,
            conversation_id=(
                payload.source_conversation_id
            ),
        )

    task = Task(
        user_id=current_user.id,
        source_conversation_id=(
            payload.source_conversation_id
        ),
        title=payload.title.strip(),
        description=(
            payload.description.strip()
            if payload.description
            else None
        ),
        status=payload.status,
        priority=payload.priority,
        due_at=payload.due_at,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
)
def get_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    return get_owned_task(
        db=db,
        user=current_user,
        task_id=task_id,
    )


@router.put(
    "/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    task = get_owned_task(
        db=db,
        user=current_user,
        task_id=task_id,
    )

    fields = payload.model_fields_set

    if (
        "source_conversation_id"
        in fields
        and payload.source_conversation_id
        is not None
    ):
        validate_conversation(
            db=db,
            user=current_user,
            conversation_id=(
                payload.source_conversation_id
            ),
        )

    if "title" in fields:
        if payload.title is None:
            raise HTTPException(
                status_code=(
                    status.HTTP_422_UNPROCESSABLE_ENTITY
                ),
                detail="Task title cannot be null",
            )

        task.title = payload.title.strip()

    if "description" in fields:
        task.description = (
            payload.description.strip()
            if payload.description
            else None
        )

    if "status" in fields:
        if payload.status is None:
            raise HTTPException(
                status_code=(
                    status.HTTP_422_UNPROCESSABLE_ENTITY
                ),
                detail="Task status cannot be null",
            )

        task.status = payload.status

    if "priority" in fields:
        if payload.priority is None:
            raise HTTPException(
                status_code=(
                    status.HTTP_422_UNPROCESSABLE_ENTITY
                ),
                detail="Task priority cannot be null",
            )

        task.priority = payload.priority

    if "due_at" in fields:
        task.due_at = payload.due_at

    if (
        "source_conversation_id"
        in fields
    ):
        task.source_conversation_id = (
            payload.source_conversation_id
        )

    db.commit()
    db.refresh(task)

    return task


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    task = get_owned_task(
        db=db,
        user=current_user,
        task_id=task_id,
    )

    db.delete(task)
    db.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )