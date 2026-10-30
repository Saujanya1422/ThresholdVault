"""Share formatting, serialization, and checksum validation."""

import binascii
import re
from dataclasses import dataclass
from typing import Optional

from app.crypto.shamir import IncompatibleShareError


@dataclass
class Share:
    """Institutional Share container."""
    share_id: str
    secret_id: str
    x: int
    payload: bytes
    threshold: int
    total_shares: int

    @property
    def payload_hex(self) -> str:
        return self.payload.hex()

    @property
    def checksum(self) -> str:
        """Compute CRC32 checksum for payload integrity verification."""
        crc = binascii.crc32(self.payload) & 0xFFFFFFFF
        return f"{crc:08x}"

    def serialize(self) -> str:
        """Serialize share to institutional armored token:
        TVSHR:v1:{share_id}:{secret_id}:{x}:{threshold}:{total_shares}:{payload_hex}:{checksum}
        """
        return (
            f"TVSHR:v1:{self.share_id}:{self.secret_id}:{self.x}:"
            f"{self.threshold}:{self.total_shares}:{self.payload_hex}:{self.checksum}"
        )


def format_share(share: Share) -> str:
    """Format a share into an armored string representation."""
    return share.serialize()


def parse_share(armored: str) -> Share:
    """Parse and validate an armored share string.
    
    Raises IncompatibleShareError if malformed or checksum does not match.
    """
    clean_str = armored.strip()
    parts = clean_str.split(":")
    if len(parts) != 9:
        raise IncompatibleShareError(
            f"Invalid share format: expected 9 colon-delimited segments, got {len(parts)}"
        )

    prefix, version, share_id, secret_id, x_str, thresh_str, total_str, payload_hex, checksum = parts

    if prefix != "TVSHR" or version != "v1":
        raise IncompatibleShareError(f"Unsupported share protocol prefix or version: {prefix}:{version}")

    try:
        x = int(x_str)
        threshold = int(thresh_str)
        total_shares = int(total_str)
    except ValueError as e:
        raise IncompatibleShareError(f"Invalid integer fields in share: {e}")

    if not (1 <= x <= 255):
        raise IncompatibleShareError(f"Share index x={x} out of range [1, 255]")

    try:
        payload = bytes.fromhex(payload_hex)
    except ValueError:
        raise IncompatibleShareError("Invalid hexadecimal share payload")

    expected_crc = binascii.crc32(payload) & 0xFFFFFFFF
    expected_checksum = f"{expected_crc:08x}"

    if checksum.lower() != expected_checksum.lower():
        raise IncompatibleShareError(
            f"Share checksum mismatch: header claims {checksum}, computed {expected_checksum}. Share is corrupted!"
        )

    return Share(
        share_id=share_id,
        secret_id=secret_id,
        x=x,
        payload=payload,
        threshold=threshold,
        total_shares=total_shares,
    )
