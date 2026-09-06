import hashlib

from fastapi import (
    HTTPException,
    Request,
    status,
)
from redis.exceptions import RedisError

from app.core.redis import redis_client


def _safe_key_part(
    value: str,
) -> str:
    return hashlib.sha256(
        value.strip()
        .lower()
        .encode("utf-8")
    ).hexdigest()[:32]


def _client_ip(
    request: Request,
) -> str:
    if request.client:
        return (
            request.client.host
            or "unknown"
        )

    return "unknown"


def _increment_counter(
    key: str,
    window_seconds: int,
) -> int | None:
    try:
        current = redis_client.incr(
            key
        )

        if current == 1:
            redis_client.expire(
                key,
                window_seconds,
            )

        return int(current)

    except RedisError as exc:
        print(
            "RATE LIMIT REDIS ERROR:",
            exc,
        )

        return None


def enforce_rate_limit(
    request: Request,
    action: str,
    limit: int,
    window_seconds: int,
    identifier: str | None = None,
) -> None:
    ip = _client_ip(
        request
    )

    ip_key = (
        "memora:rate-limit:"
        f"{action}:ip:"
        f"{_safe_key_part(ip)}"
    )

    ip_count = _increment_counter(
        key=ip_key,
        window_seconds=(
            window_seconds
        ),
    )

    if (
        ip_count is not None
        and ip_count > limit
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_429_TOO_MANY_REQUESTS
            ),
            detail=(
                "Too many requests. "
                "Please try again later."
            ),
            headers={
                "Retry-After":
                    str(
                        window_seconds
                    )
            },
        )

    if identifier:
        identifier_key = (
            "memora:rate-limit:"
            f"{action}:identifier:"
            f"{_safe_key_part(identifier)}"
        )

        identifier_count = (
            _increment_counter(
                key=identifier_key,
                window_seconds=(
                    window_seconds
                ),
            )
        )

        if (
            identifier_count
            is not None
            and identifier_count
            > limit
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_429_TOO_MANY_REQUESTS
                ),
                detail=(
                    "Too many requests. "
                    "Please try again later."
                ),
                headers={
                    "Retry-After":
                        str(
                            window_seconds
                        )
                },
            )