from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_auth_token,
    hash_auth_token,
    hash_password,
    verify_password,
)


def test_password_hash_and_verify():
    password = "MemoraTest123!"

    hashed = hash_password(
        password
    )

    assert hashed != password

    assert verify_password(
        password,
        hashed,
    )

    assert not verify_password(
        "WrongPassword123!",
        hashed,
    )


def test_verify_password_handles_none():
    assert not verify_password(
        "Anything123!",
        None,
    )


def test_access_token_round_trip():
    subject = (
        "test-user-id"
    )

    token = create_access_token(
        subject=subject
    )

    decoded_subject = (
        decode_access_token(
            token
        )
    )

    assert (
        decoded_subject
        == subject
    )


def test_invalid_access_token():
    result = (
        decode_access_token(
            "this-is-not-a-valid-jwt"
        )
    )

    assert result is None


def test_auth_token_generation():
    first = (
        generate_auth_token()
    )

    second = (
        generate_auth_token()
    )

    assert first
    assert second
    assert first != second


def test_auth_token_hash_is_deterministic():
    token = (
        "memora-test-token"
    )

    first_hash = (
        hash_auth_token(
            token
        )
    )

    second_hash = (
        hash_auth_token(
            token
        )
    )

    assert (
        first_hash
        == second_hash
    )

    assert len(first_hash) == 64