import logging
from json import JSONDecodeError
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.settings import Settings

logger = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False)
SIGNING_ALGORITHMS = ["ES256", "RS256"]


class IdentityResponse(BaseModel):
    id: UUID


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing bearer token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def verifier_unavailable() -> HTTPException:
    logger.error(
        "JWT verification unavailable; check trusted issuer/JWKS configuration"
    )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Authentication verification unavailable",
    )


class JwtVerifier:
    def __init__(self, settings: Settings) -> None:
        project_url = (
            str(settings.supabase_url).rstrip("/") if settings.supabase_url else None
        )
        self.issuer = (
            str(settings.supabase_jwt_issuer)
            if settings.supabase_jwt_issuer
            else f"{project_url}/auth/v1"
            if project_url
            else None
        )
        jwks_url = (
            str(settings.supabase_jwks_url)
            if settings.supabase_jwks_url
            else f"{self.issuer}/.well-known/jwks.json"
            if self.issuer
            else None
        )
        self.audience = settings.supabase_jwt_audience
        self.client = (
            TrustedJwksClient(
                jwks_url, cache_keys=False, cache_jwk_set=True, lifespan=300, timeout=5
            )
            if jwks_url
            else None
        )

    def verify(self, token: str) -> IdentityResponse:
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") not in SIGNING_ALGORITHMS:
                raise unauthorized()
            kid = header.get("kid")
            if not isinstance(kid, str) or not kid:
                raise unauthorized()
            if self.client is None or self.issuer is None:
                raise verifier_unavailable()
            signing_key = self.client.get_signing_key(kid)
            try:
                claims = jwt.decode(
                    token,
                    key=signing_key,
                    algorithms=SIGNING_ALGORITHMS,
                    issuer=self.issuer,
                    audience=self.audience,
                    options={"require": ["exp", "iss", "aud", "sub"]},
                )
            except (TypeError, ValueError, OverflowError):
                # PyJWT's NumericDate conversion can raise for malformed claim types.
                raise unauthorized() from None
            subject = claims["sub"]
            if not isinstance(subject, str) or claims.get("role") != "authenticated":
                raise unauthorized()
            try:
                identity = UUID(subject)
            except ValueError:
                raise unauthorized() from None
            return IdentityResponse(id=identity)
        except (jwt.PyJWKClientConnectionError, jwt.PyJWKSetError):
            raise verifier_unavailable() from None
        except (jwt.InvalidTokenError, jwt.InvalidKeyError, jwt.PyJWKClientError):
            raise unauthorized() from None


class TrustedJwksClient(jwt.PyJWKClient):
    def fetch_data(self) -> object:
        try:
            data: object = super().fetch_data()
            return data
        except (jwt.PyJWTError, JSONDecodeError, UnicodeDecodeError):
            raise verifier_unavailable() from None


def authenticated_identity(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> IdentityResponse:
    if credentials is None:
        raise unauthorized()
    verifier = request.app.state.jwt_verifier
    if not isinstance(verifier, JwtVerifier):
        raise verifier_unavailable()
    return verifier.verify(credentials.credentials)
