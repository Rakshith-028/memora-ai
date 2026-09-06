from datetime import (
    datetime,
    timezone,
)
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import (
    BaseModel,
    Field,
)
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.models.user import User
from app.tools.registry import (
    tool_registry,
)


router = APIRouter(
    prefix="/tools",
    tags=["Tools"],
)


class ToolExecuteRequest(
    BaseModel
):
    tool_name: str = Field(
        min_length=1,
        max_length=100,
    )

    arguments: dict[
        str,
        Any
    ] = Field(
        default_factory=dict
    )


@router.get("")
def list_tools(
    current_user: User = Depends(
        get_current_user
    ),
):
    return {
        "tools": (
            tool_registry.list_tools()
        )
    }


@router.post("/execute")
def execute_tool(
    payload: ToolExecuteRequest,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        get_current_user
    ),
):
    try:
        result = (
            tool_registry.execute(
                tool_name=(
                    payload.tool_name
                ),
                arguments=(
                    payload.arguments
                ),
                db=db,
                user=current_user,
            )
        )

    except KeyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=str(exc),
        )

    except (
        ValueError,
        TypeError,
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(exc),
        )

    return {
        "status": "completed",
        "tool": payload.tool_name,
        "result": result,
        "executed_at": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),
    }