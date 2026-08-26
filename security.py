"""Security primitives shared by the Sofia API.

This module deliberately contains no credentials. Production sessions and
rate-limit counters must be persisted in PostgreSQL/Redis, not in process
memory, when more than one instance is deployed.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.fernet import Fernet

PASSWORD_HASHER = PasswordHasher(
    time_cost=3,
    memory_cost=65_536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)
PASSWORD_POLICY = re.compile(r"^(?=.{8,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$")
EMAIL_POLICY = re.compile(r"^[^@\s]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,63}$")
# Generated once per process and used only to keep unknown-user login timing
# close to known-user login timing. It is not a user credential.
FAKE_PASSWORD_HASH = PASSWORD_HASHER.hash(secrets.token_urlsafe(32))


def validate_password(password: str) -> bool:
    return bool(PASSWORD_POLICY.fullmatch(password))


def normalize_email(email: str) -> str:
    value = email.strip().casefold()
    if not EMAIL_POLICY.fullmatch(value):
        raise ValueError("E-mail inválido")
    return value


def hash_password(password: str) -> str:
    if not validate_password(password):
        raise ValueError("A senha deve ter 8-128 caracteres, maiúscula, minúscula, número e símbolo.")
    return PASSWORD_HASHER.hash(password)


def verify_password(stored_hash: str | None, password: str) -> bool:
    candidate = stored_hash or FAKE_PASSWORD_HASH
    try:
        return PASSWORD_HASHER.verify(candidate, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def generic_auth_failure() -> dict[str, str]:
    """Never disclose whether the email or password was incorrect."""
    return {"error": "Não foi possível autenticar com os dados informados."}


def honeypot_triggered(payload: dict) -> bool:
    """Bots often fill hidden fields; legitimate clients leave them empty."""
    return any(str(payload.get(field, "")).strip() for field in ("website", "company_website"))


def new_session_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(48)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, digest


def token_digest(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def secure_equals(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


@dataclass
class MemoryRateLimiter:
    """Development fallback; replace with Redis/PostgreSQL for production."""

    max_attempts: int = 8
    window_seconds: int = 300

    def __post_init__(self) -> None:
        self._attempts: dict[str, deque[float]] = defaultdict(deque)

    def allowed(self, key: str) -> bool:
        now = time.monotonic()
        attempts = self._attempts[key]
        while attempts and now - attempts[0] > self.window_seconds:
            attempts.popleft()
        if len(attempts) >= self.max_attempts:
            return False
        attempts.append(now)
        return True


login_limiter = MemoryRateLimiter()
access_request_limiter = MemoryRateLimiter(max_attempts=5, window_seconds=600)


def encrypt_totp_secret(secret: str) -> bytes:
    key = os.getenv("SOFIA_TOTP_KEY")
    if not key:
        raise RuntimeError("SOFIA_TOTP_KEY não configurada")
    return Fernet(key.encode()).encrypt(secret.encode())


def decrypt_totp_secret(ciphertext: bytes) -> str:
    key = os.getenv("SOFIA_TOTP_KEY")
    if not key:
        raise RuntimeError("SOFIA_TOTP_KEY não configurada")
    return Fernet(key.encode()).decrypt(ciphertext).decode()
