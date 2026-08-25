import os

import pyotp
from cryptography.fernet import Fernet

from security import MemoryRateLimiter, encrypt_totp_secret, decrypt_totp_secret, generic_auth_failure, validate_password


def test_password_policy_and_generic_failure_do_not_disclose_account_state():
    assert validate_password("ValidPass9!")
    assert not validate_password("weakpass")
    assert generic_auth_failure() == {"error": "Não foi possível autenticar com os dados informados."}


def test_rate_limiter_blocks_after_bound_and_expiry_is_configurable():
    limiter = MemoryRateLimiter(max_attempts=2, window_seconds=60)
    assert limiter.allowed("local-test")
    assert limiter.allowed("local-test")
    assert not limiter.allowed("local-test")
    assert limiter.allowed("other-key")


def test_totp_secret_is_encrypted_and_code_verifies(monkeypatch):
    monkeypatch.setenv("SOFIA_TOTP_KEY", Fernet.generate_key().decode())
    secret = pyotp.random_base32()
    encrypted = encrypt_totp_secret(secret)
    assert secret not in encrypted.decode("latin-1", errors="ignore")
    assert decrypt_totp_secret(encrypted) == secret
    assert pyotp.TOTP(secret).verify(pyotp.TOTP(secret).now())


def test_public_route_matching_is_exact_and_origin_check_rejects_cross_site_writes():
    from server import is_public_path, request_origin_allowed

    assert is_public_path("/auth/login")
    assert is_public_path("/auth/login/")
    assert not is_public_path("/proxy/auth/login")
    assert request_origin_allowed("http://127.0.0.1:8443", "", {"http://127.0.0.1:8443"})
    assert request_origin_allowed("", "http://127.0.0.1:8443/app", {"http://127.0.0.1:8443"})
    assert not request_origin_allowed("https://attacker.invalid", "", {"http://127.0.0.1:8443"})
