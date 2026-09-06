from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.memory import Memory
from app.models.user import User
from app.schemas.memory import MemoryCreate, MemoryResponse
from app.services.memory import memory_service


router = APIRouter(
    prefix="/memories",
    tags=["Memories"],
)


@router.post(
    "",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_memory(
    payload: MemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return memory_service.create_memory(
        db=db,
        user=current_user,
        payload=payload,
    )


@router.get(
    "",
    response_model=list[MemoryResponse],
)
def list_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memories = db.scalars(
        select(Memory)
        .where(
            Memory.user_id == current_user.id,
            Memory.is_active.is_(True),
        )
        .order_by(
            Memory.created_at.desc()
        )
    ).all()

    return memories


@router.delete(
    "/{memory_id}",
    status_code=status.HTTP_200_OK,
)
def delete_memory(
    memory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memory = db.scalar(
        select(Memory).where(
            Memory.id == memory_id,
            Memory.user_id == current_user.id,
            Memory.is_active.is_(True),
        )
    )

    if memory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found",
        )

    memory.is_active = False

    db.commit()

    return {
        "status": "deleted",
        "memory_id": str(memory.id),
    }


@router.post("/cleanup")
def cleanup_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = memory_service.cleanup_memories(
        db=db,
        user=current_user,
    )

    return {
        "status": "completed",
        "deactivated": result["deactivated"],
        "merged": result["merged"],
    }