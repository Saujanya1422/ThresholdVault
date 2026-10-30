"""Storage Cipher for Institutional Share Persistence (Encryption-at-Rest).

Simulates an HSM-managed envelope encryption layer:
- Master Storage Key (derived via HKDF/SHA256 from secure environment configuration)
- AES-256-GCM authenticated encryption for share payloads
- Nonce and ciphertext storage (never plaintext in database records)
- Prevents plaintext share leakage in SQLite database dumps or memory snapshots
"""

import base64
import hashlib
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings


class StorageCipher:
    """AES-256-GCM Encryption-at-Rest engine."""

    _KEY: bytes = hashlib.sha256(settings.STORAGE_MASTER_KEY.encode()).digest()

    @classmethod
    def encrypt(cls, plaintext: bytes) -> str:
        """Encrypt plaintext bytes with AES-256-GCM.
        
        Returns:
            Base64 encoded string: nonce (12 bytes) + ciphertext + tag (16 bytes).
        """
        aesgcm = AESGCM(cls._KEY)
        nonce = os.urandom(12)  # 96-bit nonce for AES-GCM
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        combined = nonce + ciphertext
        return base64.b64encode(combined).decode("ascii")

    @classmethod
    def decrypt(cls, encrypted_b64: str) -> bytes:
        """Decrypt AES-256-GCM encrypted payload.
        
        Raises ValueError if authentication tag fails or data is corrupted.
        """
        try:
            combined = base64.b64decode(encrypted_b64)
            if len(combined) < 28:
                raise ValueError("Encrypted payload too short for AES-GCM")
            nonce = combined[:12]
            ciphertext = combined[12:]
            aesgcm = AESGCM(cls._KEY)
            return aesgcm.decrypt(nonce, ciphertext, None)
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")
