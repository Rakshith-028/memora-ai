import pytest
from fastapi import HTTPException, Request
from pydantic import ValidationError

from app.core.config import Settings
from app.core import rate_limit


def production_settings(
    **overrides,
):
    values = {
        "app_env": "production",
        "debug": False,
        "database_url": (
            "postgresql://test:test@localhost/test"
        ),
        "redis_url": (
            "redis://localhost:6379/0"
        ),
        "secret_key": (
            "a" * 64
        ),
        "frontend_url": (
            "https://memora.example"
        ),
        "cors_origins": (
            "https://memora.example"
        ),
        "trusted_hosts": (
            "memora.example"
        ),
    }

    values.update(
        overrides
    )

    return Settings(
        **values
    )


def make_request():
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/auth/login",
            "headers": [],
            "client": (
                "127.0.0.1",
                50000,
            ),
            "server": (
                "127.0.0.1",
                8000,
            ),
            "scheme": "http",
        }
    )


def test_valid_production_config():
    settings = (
        production_settings()
    )

    assert (
        settings.is_production
        is True
    )

    assert (
        settings.allowed_hosts
        == ["memora.example"]
    )

    assert (
        settings.allowed_cors_origins
        == [
            "https://memora.example"
        ]
    )


def test_production_rejects_debug():
    with pytest.raises(
        ValidationError
    ):
        production_settings(
            debug=True
        )


def test_production_requires_https():
    with pytest.raises(
        ValidationError
    ):
        production_settings(
            frontend_url=(
                "http://memora.example"
            )
        )


def test_production_rejects_http_cors():
    with pytest.raises(
        ValidationError
    ):
        production_settings(
            cors_origins=(
                "http://memora.example"
            )
        )


def test_production_rejects_wildcard_host():
    with pytest.raises(
        ValidationError
    ):
        production_settings(
            trusted_hosts="*"
        )


def test_rate_limit_allows_request(
    monkeypatch,
):
    monkeypatch.setattr(
        rate_limit,
        "_increment_counter",
        lambda key,
        window_seconds: 1,
    )

    rate_limit.enforce_rate_limit(
        request=make_request(),
        action="login-test",
        limit=5,
        window_seconds=60,
        identifier=(
            "test@example.com"
        ),
    )


def test_rate_limit_blocks_request(
    monkeypatch,
):
    monkeypatch.setattr(
        rate_limit,
        "_increment_counter",
        lambda key,
        window_seconds: 6,
    )

    with pytest.raises(
        HTTPException
    ) as exc_info:
        rate_limit.enforce_rate_limit(
            request=make_request(),
            action="login-test",
            limit=5,
            window_seconds=60,
        )

    assert (
        exc_info.value.status_code
        == 429
    )

    assert (
        exc_info.value.headers[
            "Retry-After"
        ]
        == "60"
    )


def test_rate_limit_hashes_identifier():
    raw_value = (
        "Sensitive@Example.com"
    )

    hashed = (
        rate_limit._safe_key_part(
            raw_value
        )
    )

    assert (
        raw_value.lower()
        not in hashed
    )

    assert len(hashed) == 32