"""Unit tests for Galois Field GF(2^8) and Shamir Secret Sharing."""

import pytest
from app.crypto.gf256 import GF256
from app.crypto.shamir import (
    CryptoError,
    DuplicateShareError,
    IncompatibleShareError,
    InsufficientSharesError,
    ShamirSecretSharing,
)
from app.crypto.shares import Share, format_share, parse_share


def test_gf256_basic_arithmetic():
    """Verify finite field axioms in GF(2^8)."""
    # Addition is XOR
    assert GF256.add(0x57, 0x83) == 0xD4
    assert GF256.sub(0xD4, 0x83) == 0x57
    assert GF256.add(0x42, 0x42) == 0

    # Multiplication identity
    for a in range(256):
        assert GF256.mul(a, 1) == a
        assert GF256.mul(a, 0) == 0

    # Inverses
    for a in range(1, 256):
        inv = GF256.inv(a)
        assert GF256.mul(a, inv) == 1

    # Division by zero check
    with pytest.raises(ZeroDivisionError):
        GF256.div(42, 0)


def test_shamir_split_and_reconstruct_3_of_5():
    """Verify standard 3-of-5 secret reconstruction with any 3-share subset."""
    secret = b"THRESHOLD_VAULT_ACADEMIC_DEMO_SECRET_2026_KEY"
    threshold = 3
    total_shares = 5

    shares = ShamirSecretSharing.split_secret(secret, threshold, total_shares)
    assert len(shares) == 5

    # Any subset of size 3 must reconstruct the exact original secret
    subsets_to_test = [
        [shares[0], shares[1], shares[2]],  # {1, 2, 3}
        [shares[0], shares[1], shares[4]],  # {1, 2, 5}
        [shares[1], shares[2], shares[3]],  # {2, 3, 4}
        [shares[2], shares[3], shares[4]],  # {3, 4, 5}
        [shares[0], shares[2], shares[4]],  # {1, 3, 5}
    ]

    for subset in subsets_to_test:
        recovered = ShamirSecretSharing.reconstruct_secret(subset, threshold)
        assert recovered == secret


def test_shamir_insufficient_shares():
    """Verify that fewer than k shares cannot reconstruct and raise InsufficientSharesError."""
    secret = b"CRITICAL_PRIVATE_KEY_DATA"
    shares = ShamirSecretSharing.split_secret(secret, threshold=3, total_shares=5)

    # 2 shares should be rejected
    two_shares = [shares[0], shares[1]]
    with pytest.raises(InsufficientSharesError):
        ShamirSecretSharing.reconstruct_secret(two_shares, threshold=3)

    # 1 share should be rejected
    one_share = [shares[2]]
    with pytest.raises(InsufficientSharesError):
        ShamirSecretSharing.reconstruct_secret(one_share, threshold=3)


def test_shamir_duplicate_shares_rejected():
    """Verify that duplicate share indices are rejected."""
    secret = b"CONFIDENTIAL_INSTITUTIONAL_KEY"
    shares = ShamirSecretSharing.split_secret(secret, threshold=3, total_shares=5)

    duplicate_subset = [shares[0], shares[0], shares[1]]
    with pytest.raises(DuplicateShareError):
        ShamirSecretSharing.reconstruct_secret(duplicate_subset, threshold=3)


def test_shamir_incompatible_shares_rejected():
    """Verify that shares of mismatched length are rejected."""
    secret_a = b"SHORT_SECRET"
    secret_b = b"MUCH_LONGER_SECRET_WITH_MORE_BYTES"

    shares_a = ShamirSecretSharing.split_secret(secret_a, threshold=2, total_shares=3)
    shares_b = ShamirSecretSharing.split_secret(secret_b, threshold=2, total_shares=3)

    mismatched = [shares_a[0], shares_b[1]]
    with pytest.raises(IncompatibleShareError):
        ShamirSecretSharing.reconstruct_secret(mismatched, threshold=2)


def test_invalid_policy_parameters():
    """Verify boundary checks on threshold k and total shares n."""
    secret = b"SAMPLE"
    with pytest.raises(ValueError):
        ShamirSecretSharing.split_secret(secret, threshold=0, total_shares=5)

    with pytest.raises(ValueError):
        ShamirSecretSharing.split_secret(secret, threshold=5, total_shares=3)  # k > n

    with pytest.raises(ValueError):
        ShamirSecretSharing.split_secret(b"", threshold=2, total_shares=3)  # Empty secret


def test_share_formatting_and_checksum_verification():
    """Verify armored share format and checksum tamper detection."""
    share_obj = Share(
        share_id="share-uuid-1234",
        secret_id="secret-uuid-5678",
        x=2,
        payload=b"\xde\xad\xbe\xef\xca\xfe\xba\xbe",
        threshold=3,
        total_shares=5,
    )

    armored = format_share(share_obj)
    assert armored.startswith("TVSHR:v1:share-uuid-1234:secret-uuid-5678:2:3:5:")

    # Successfully parsed
    parsed = parse_share(armored)
    assert parsed.x == 2
    assert parsed.payload == b"\xde\xad\xbe\xef\xca\xfe\xba\xbe"
    assert parsed.threshold == 3

    # Tamper with the payload hex string
    corrupted_armored = armored.replace("deadbeef", "cafebabe")
    with pytest.raises(IncompatibleShareError):
        parse_share(corrupted_armored)
