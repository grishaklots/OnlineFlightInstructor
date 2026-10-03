import json
import time
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock
from urllib.error import URLError

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import HttpUrl, ValidationError
from pytest import LogCaptureFixture, MonkeyPatch

from app.auth import JwtVerifier
from app.main import create_app
from app.settings import Settings, load_settings

ISSUER = "https://auth.example/auth/v1"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"
SUBJECT = "c0ed5c09-1aa1-43aa-a95a-1c081393e212"
OTHER_SUBJECT = "5edb8701-f0de-490a-ac7a-0072b0e4c6cb"
KID = "test-key"


@pytest.fixture(scope="module")
def private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def public_jwk(key: rsa.RSAPrivateKey, kid: str = KID) -> dict[str, object]:
    result: dict[str, object] = json.loads(
        jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key())
    )
    return {**result, "kid": kid, "alg": "RS256", "use": "sig"}


def claims() -> dict[str, object]:
    return {
        "iss": ISSUER,
        "aud": "authenticated",
        "exp": int(time.time()) + 300,
        "sub": SUBJECT,
        "role": "authenticated",
    }


def signed_token(
    key: rsa.RSAPrivateKey,
    payload: dict[str, object] | None = None,
    kid: str = KID,
) -> str:
    return jwt.encode(
        claims() if payload is None else payload,
        key,
        algorithm="RS256",
        headers={"kid": kid},
    )


def auth_settings() -> Settings:
    return Settings(
        supabase_jwt_issuer=HttpUrl(ISSUER),
        supabase_jwks_url=HttpUrl(JWKS_URL),
    )


@pytest.fixture
def jwks_http(monkeypatch: MonkeyPatch, private_key: rsa.RSAPrivateKey) -> Mock:
    fetch = Mock()
    fetch.side_effect = lambda *_args, **_kwargs: BytesIO(
        json.dumps({"keys": [public_jwk(private_key)]}).encode()
    )
    opener = Mock(open=fetch)
    monkeypatch.setattr(
        "jwt.jwks_client.urllib.request.build_opener", Mock(return_value=opener)
    )
    return fetch


@pytest.mark.parametrize(
    "authorization", [None, "", "Bearer", "Basic credentials", "Bearer not-a-jwt"]
)
def test_missing_or_malformed_token_is_401(
    authorization: str | None, jwks_http: Mock
) -> None:
    headers = {"Authorization": authorization} if authorization is not None else {}
    with TestClient(create_app(auth_settings())) as client:
        response = client.get("/api/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {"detail": "Invalid or missing bearer token"}
    jwks_http.assert_not_called()


def test_valid_token_returns_only_verified_subject(
    private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    payload = {
        **claims(),
        "user_id": OTHER_SUBJECT,
        "user_metadata": {"instructor_id": OTHER_SUBJECT},
    }
    token = signed_token(private_key, payload)
    with TestClient(create_app(auth_settings())) as client:
        response = client.get(
            f"/api/me?user_id={OTHER_SUBJECT}&instructor_id={OTHER_SUBJECT}",
            headers={"Authorization": f"Bearer {token}", "X-User-ID": OTHER_SUBJECT},
        )
        assert client.get("/api/me").status_code == 401

    assert response.status_code == 200
    assert response.json() == {"id": SUBJECT}
    request = jwks_http.call_args.args[0]
    assert request.full_url == JWKS_URL
    assert request.headers == {}
    assert jwks_http.call_args.kwargs["timeout"] == 5


@pytest.mark.parametrize(
    ("claim", "value"),
    [
        ("exp", int(time.time()) - 60),
        ("exp", "not-an-expiration"),
        ("exp", None),
        ("exp", []),
        ("exp", {}),
        ("exp", float("inf")),
        ("nbf", None),
        ("iat", []),
        ("iss", "https://untrusted.example/auth/v1"),
        ("iss", ISSUER + "/"),
        ("aud", "another-audience"),
        ("sub", "not-a-user-uuid"),
        ("sub", 123),
        ("sub", ""),
        ("role", "service_role"),
        ("role", "anon"),
        ("nbf", int(time.time()) + 3600),
        ("iat", int(time.time()) + 3600),
    ],
)
def test_invalid_claims_are_401(
    claim: str, value: object, private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    token = signed_token(private_key, {**claims(), claim: value})
    with TestClient(create_app(auth_settings())) as client:
        response = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert token not in response.text


@pytest.mark.parametrize("claim", ["exp", "iss", "aud", "sub", "role"])
def test_required_claims_cannot_be_omitted(
    claim: str, private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    payload = claims()
    del payload[claim]
    token = signed_token(private_key, payload)
    with TestClient(create_app(auth_settings())) as client:
        assert (
            client.get(
                "/api/me", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 401
        )


def test_signature_from_wrong_key_is_rejected(
    jwks_http: Mock,
) -> None:
    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = signed_token(wrong_key)
    with TestClient(create_app(auth_settings())) as client:
        assert (
            client.get(
                "/api/me", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 401
        )


def test_tampered_payload_is_rejected(
    private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    original = signed_token(private_key).split(".")
    changed = signed_token(private_key, {**claims(), "sub": OTHER_SUBJECT}).split(".")
    token = ".".join([original[0], changed[1], original[2]])
    with TestClient(create_app(auth_settings())) as client:
        assert (
            client.get(
                "/api/me", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 401
        )


@pytest.mark.parametrize("algorithm", ["none", "HS256", "RS512"])
def test_disallowed_algorithms_are_rejected_without_fetching_keys(
    algorithm: str, private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    key: str | rsa.RSAPrivateKey = private_key
    if algorithm == "none":
        key = ""
    elif algorithm == "HS256":
        key = "synthetic-test-secret-not-a-project-key"
    token = jwt.encode(claims(), key, algorithm=algorithm, headers={"kid": KID})
    with TestClient(create_app(auth_settings())) as client:
        assert (
            client.get(
                "/api/me", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 401
        )
    jwks_http.assert_not_called()


@pytest.mark.parametrize("kid", [None, ""])
def test_missing_key_id_is_rejected(
    kid: str | None, private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    headers: dict[str, str] = {"kid": kid} if kid is not None else {}
    token = jwt.encode(claims(), private_key, algorithm="RS256", headers=headers)
    with TestClient(create_app(auth_settings())) as client:
        assert (
            client.get(
                "/api/me", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 401
        )
    jwks_http.assert_not_called()


def test_cached_keys_and_unknown_kid_fetch_cooldown(
    private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    verifier = JwtVerifier(auth_settings())
    for _ in range(3):
        assert str(verifier.verify(signed_token(private_key)).id) == SUBJECT
    for _ in range(3):
        with pytest.raises(HTTPException) as failure:
            verifier.verify(signed_token(private_key, kid="unknown"))
        assert failure.value.status_code == 401
    assert jwks_http.call_count == 1


def test_rotation_refreshes_after_cooldown_and_old_keys_expire(
    private_key: rsa.RSAPrivateKey, jwks_http: Mock, monkeypatch: MonkeyPatch
) -> None:
    now = time.monotonic()
    monkeypatch.setattr("jwt.jwks_client.time.monotonic", lambda: now)
    verifier = JwtVerifier(auth_settings())
    assert str(verifier.verify(signed_token(private_key)).id) == SUBJECT
    replacement = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwks_http.side_effect = lambda *_args, **_kwargs: BytesIO(
        json.dumps({"keys": [public_jwk(replacement, "replacement")]}).encode()
    )
    now += 31
    assert (
        str(verifier.verify(signed_token(replacement, kid="replacement")).id) == SUBJECT
    )
    assert jwks_http.call_count == 2
    now += 301
    with pytest.raises(HTTPException) as failure:
        verifier.verify(signed_token(private_key))
    assert failure.value.status_code == 401
    assert jwks_http.call_count == 3


def test_ecdsa_project_keys_are_supported(
    private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    ec_key = ec.generate_private_key(ec.SECP256R1())
    jwk: dict[str, object] = json.loads(
        jwt.algorithms.ECAlgorithm.to_jwk(ec_key.public_key())
    )
    jwks_http.side_effect = lambda *_args, **_kwargs: BytesIO(
        json.dumps(
            {"keys": [{**jwk, "kid": KID, "alg": "ES256", "use": "sig"}]}
        ).encode()
    )
    token = jwt.encode(claims(), ec_key, algorithm="ES256", headers={"kid": KID})
    with TestClient(create_app(auth_settings())) as client:
        response = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"id": SUBJECT}


def test_token_cannot_select_jwks_endpoint(
    private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    token = jwt.encode(
        claims(),
        private_key,
        algorithm="RS256",
        headers={
            "kid": KID,
            "jku": "https://untrusted.example/keys",
            "x5u": "https://untrusted.example/certificate",
        },
    )
    with TestClient(create_app(auth_settings())) as client:
        assert (
            client.get(
                "/api/me", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 200
        )
    assert jwks_http.call_args.args[0].full_url == JWKS_URL


@pytest.mark.parametrize(
    "response", ["network", "invalid-json", "invalid-shape", "empty"]
)
def test_unusable_jwks_is_sanitized_503(
    response: str,
    private_key: rsa.RSAPrivateKey,
    jwks_http: Mock,
    caplog: LogCaptureFixture,
) -> None:
    if response == "network":
        jwks_http.side_effect = URLError("internal diagnostic must not leak")
    else:
        contents = {
            "invalid-json": b"not-json",
            "invalid-shape": b"[]",
            "empty": b'{"keys":[]}',
        }
        jwks_http.side_effect = lambda *_args, **_kwargs: BytesIO(contents[response])
    token = signed_token(private_key)
    with TestClient(create_app(auth_settings())) as client:
        result = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert result.status_code == 503
    assert result.json() == {"detail": "Authentication verification unavailable"}
    assert "JWT verification unavailable" in caplog.text
    assert token not in caplog.text + result.text
    assert "internal diagnostic" not in caplog.text + result.text


def test_missing_auth_configuration_is_explicit(
    private_key: rsa.RSAPrivateKey, jwks_http: Mock
) -> None:
    with TestClient(create_app(Settings())) as client:
        assert client.get("/api/me").status_code == 401
        result = client.get(
            "/api/me", headers={"Authorization": f"Bearer {signed_token(private_key)}"}
        )
        assert client.get("/health").json() == {"status": "ok"}
    assert result.status_code == 503
    jwks_http.assert_not_called()


def test_authorization_header_cors_preflight() -> None:
    with TestClient(create_app(Settings())) as client:
        response = client.options(
            "/api/me",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        assert (
            client.options(
                "/api/me",
                headers={
                    "Origin": "https://untrusted.example",
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "authorization",
                },
            ).status_code
            == 400
        )
    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
    assert "access-control-allow-credentials" not in response.headers


def test_project_url_derives_trusted_issuer_and_jwks() -> None:
    verifier = JwtVerifier(Settings(supabase_url=HttpUrl("https://auth.example")))
    assert verifier.issuer == ISSUER
    assert verifier.client is not None
    assert verifier.client.uri == JWKS_URL
    assert verifier.audience == "authenticated"


@pytest.mark.parametrize(
    "field", ["supabase_url", "supabase_jwt_issuer", "supabase_jwks_url"]
)
def test_remote_auth_configuration_requires_https(field: str) -> None:
    with pytest.raises(ValidationError, match="require HTTPS"):
        Settings.model_validate({field: "http://auth.example"})


def test_dotenv_configuration_and_process_override(
    tmp_path: Path, monkeypatch: MonkeyPatch
) -> None:
    env = tmp_path / ".env"
    env.write_text(
        "SUPABASE_URL=https://auth.example\n"
        "SUPABASE_JWT_AUDIENCE=from-file\n"
        'ALLOWED_ORIGINS=["http://localhost:5188"]\n'
        "SUPABASE_SECRET_KEY=unused-test-value\n",
        encoding="utf-8",
    )
    monkeypatch.setattr("app.settings.ENV_FILE", env)
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "from-process")
    settings = load_settings()
    assert settings.supabase_jwt_audience == "from-process"
    assert settings.cors_origins == ["http://localhost:5188"]
    assert "unused-test-value" not in repr(settings)
