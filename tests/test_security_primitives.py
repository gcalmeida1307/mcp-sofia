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
    assert is_public_path("/auth/activate")
    assert not is_public_path("/proxy/auth/login")
    assert request_origin_allowed("http://127.0.0.1:8443", "", {"http://127.0.0.1:8443"})
    assert request_origin_allowed("", "http://127.0.0.1:8443/app", {"http://127.0.0.1:8443"})
    assert not request_origin_allowed("https://attacker.invalid", "", {"http://127.0.0.1:8443"})


def test_totp_replay_is_rejected_and_recovery_codes_are_not_stored_plaintext():
    from server import new_recovery_codes, verify_totp_step

    secret = pyotp.random_base32()
    now = 1_800_000_000
    otp = pyotp.TOTP(secret).at(now)
    accepted_step = verify_totp_step(secret, otp, at_time=now)
    assert accepted_step is not None
    assert verify_totp_step(secret, otp, last_used_step=accepted_step, at_time=now) is None
    raw_codes, hashes = new_recovery_codes()
    assert len(raw_codes) == len(hashes) == 8
    assert not set(raw_codes) & set(hashes)


def test_inconclusive_local_answers_escalate_but_grounded_answers_do_not():
    from server import local_answer_needs_fallback

    evidence = "[Fonte: manual.txt · módulo infraestrutura · trecho]\nConteúdo"
    assert local_answer_needs_fallback("Não encontrei nas fontes recuperadas.", evidence)
    assert not local_answer_needs_fallback("A resposta consta no manual. [Fonte: manual.txt]", evidence)


def test_access_migration_preserves_existing_access_and_adds_activation_state():
    from pathlib import Path

    migration = (Path(__file__).parents[1] / "migrations" / "015_access_lifecycle_and_isolation.sql").read_text(encoding="utf-8")
    assert "DEFAULT 'authenticated'" in migration
    assert "DEFAULT 'active'" in migration
    assert "pending_activation" in migration
    assert "DROP CONSTRAINT IF EXISTS access_requests_requested_module_check" in migration


def test_approval_never_overwrites_existing_account_and_dashboards_are_scoped():
    from pathlib import Path

    server_source = (Path(__file__).parents[1] / "server.py").read_text(encoding="utf-8")
    assert "ON CONFLICT(email) DO UPDATE" not in server_source
    assert "FROM dashboards WHERE module_name=:module" in server_source
    assert "purpose='activation'" in server_source


def test_database_upgrade_script_reuses_current_database_and_preserves_env():
    from pathlib import Path

    script = (Path(__file__).parents[1] / "scripts" / "setup-postgres-local.ps1").read_text(encoding="utf-8")
    assert "$reuseExistingDatabase" in script
    assert "$existingDatabaseUrl" in script
    assert "$preservedEnv" in script
