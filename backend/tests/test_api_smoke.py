from fastapi.testclient import (
    TestClient,
)

from app.core.config import settings
from app.main import app


client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200

    data = response.json()

    assert data["name"] == settings.app_name
    assert data["status"] == "running"
    assert data["version"] == "0.1.0"


def test_security_headers_present():
    response = client.get("/")

    assert response.status_code == 200

    assert (
        response.headers[
            "x-content-type-options"
        ]
        == "nosniff"
    )

    assert (
        response.headers[
            "x-frame-options"
        ]
        == "DENY"
    )

    assert (
        response.headers[
            "referrer-policy"
        ]
        == "no-referrer"
    )

    assert (
        "camera=()"
        in response.headers[
            "permissions-policy"
        ]
    )


def test_hsts_not_enabled_in_development():
    assert settings.is_production is False

    response = client.get("/")

    assert (
        "strict-transport-security"
        not in response.headers
    )


def test_swagger_available_in_development():
    assert settings.is_production is False

    response = client.get(
        "/docs"
    )

    assert response.status_code == 200


def test_untrusted_host_is_rejected():
    response = client.get(
        "/",
        headers={
            "Host":
                "evil.example.com"
        },
    )

    assert response.status_code == 400


def test_cors_allows_frontend_origin():
    response = client.options(
        "/",
        headers={
            "Origin":
                "http://localhost:3000",
            "Access-Control-Request-Method":
                "GET",
        },
    )

    assert response.status_code == 200

    assert (
        response.headers[
            "access-control-allow-origin"
        ]
        == "http://localhost:3000"
    )


def test_login_request_validation():
    response = client.post(
        "/auth/login",
        json={},
    )

    assert response.status_code == 422


def test_google_login_request_validation():
    response = client.post(
        "/auth/google",
        json={},
    )

    assert response.status_code == 422