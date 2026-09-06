from fastapi import (
    FastAPI,
    Request,
)
from fastapi.middleware.cors import (
    CORSMiddleware,
)
from sqlalchemy import text
from starlette.middleware.trustedhost import (
    TrustedHostMiddleware,
)

from app.api.analytics import (
    router as analytics_router,
)
from app.api.auth import (
    router as auth_router,
)
from app.api.chat import (
    router as chat_router,
)
from app.api.conversations import (
    router as conversations_router,
)
from app.api.documents import (
    router as documents_router,
)
from app.api.feedback import (
    router as feedback_router,
)
from app.api.memories import (
    router as memories_router,
)
from app.api.settings import (
    router as settings_router,
)
from app.api.tasks import (
    router as tasks_router,
)
from app.api.tools import (
    router as tools_router,
)
from app.core.config import settings
from app.core.redis import redis_client
from app.db.session import engine


app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.1.0",
    description="Backend API for Memora AI",
    debug=settings.debug,
    docs_url=(
        None
        if settings.is_production
        else "/docs"
    ),
    redoc_url=(
        None
        if settings.is_production
        else "/redoc"
    ),
    openapi_url=(
        None
        if settings.is_production
        else "/openapi.json"
    ),
)


app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=(
        settings.allowed_hosts
    ),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        settings.allowed_cors_origins
    ),
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)


@app.middleware("http")
async def security_headers(
    request: Request,
    call_next,
):
    response = await call_next(
        request
    )

    response.headers[
        "X-Content-Type-Options"
    ] = "nosniff"

    response.headers[
        "X-Frame-Options"
    ] = "DENY"

    response.headers[
        "Referrer-Policy"
    ] = "no-referrer"

    response.headers[
        "Permissions-Policy"
    ] = (
        "camera=(), "
        "microphone=(), "
        "geolocation=()"
    )

    if settings.is_production:
        response.headers[
            "Strict-Transport-Security"
        ] = (
            "max-age=31536000; "
            "includeSubDomains"
        )

    return response


app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(memories_router)
app.include_router(documents_router)
app.include_router(tools_router)
app.include_router(feedback_router)
app.include_router(analytics_router)
app.include_router(tasks_router)
app.include_router(settings_router)


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "environment": settings.app_env,
        "status": "running",
        "version": "0.1.0",
    }


@app.get("/health")
async def health():
    database_status = "down"
    redis_status = "down"

    try:
        with engine.connect() as connection:
            connection.execute(
                text("SELECT 1")
            )

        database_status = "healthy"

    except Exception:
        pass

    try:
        if redis_client.ping():
            redis_status = "healthy"

    except Exception:
        pass

    overall_status = (
        "healthy"
        if (
            database_status
            == "healthy"
            and redis_status
            == "healthy"
        )
        else "degraded"
    )

    return {
        "status": overall_status,
        "services": {
            "api": "healthy",
            "database":
                database_status,
            "redis":
                redis_status,
        },
    }