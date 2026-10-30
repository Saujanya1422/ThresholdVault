"""Shamir's Secret Sharing over Galois Field GF(2^8).

This module implements threshold cryptographic secret splitting and Lagrange
interpolation over GF(2^8). A secret of N bytes is split byte-by-byte into
shares of N bytes each, using CSPRNG polynomial generation.

Threshold Policy: (k, n) where:
  - k: threshold (minimum shares required to reconstruct)
  - n: total shares generated
  - 1 <= k <= n <= 255
"""

import hashlib
import secrets
from typing import List, Tuple

from app.crypto.gf256 import GF256


class CryptoError(Exception):
    """Base exception for cryptographic operations."""
    pass


class InsufficientSharesError(CryptoError):
    """Raised when the number of valid shares is below the threshold."""
    pass


class DuplicateShareError(CryptoError):
    """Raised when duplicate share indices are supplied."""
    pass


class IncompatibleShareError(CryptoError):
    """Raised when shares have mismatched lengths or invalid formats."""
    pass


class ShamirSecretSharing:
    """Enterprise-grade Shamir Secret Sharing implementation over GF(2^8)."""

    @staticmethod
    def compute_hash(data: bytes) -> str:
        """Compute SHA-256 verification hash of secret bytes."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def generate_random_secret(num_bytes: int = 32) -> bytes:
        """Generate a cryptographically secure random secret (e.g. 256-bit key)."""
        if num_bytes < 1:
            raise ValueError("Secret length must be at least 1 byte")
        return secrets.token_bytes(num_bytes)

    @classmethod
    def split_secret(
        cls,
        secret: bytes,
        threshold: int,
        total_shares: int
    ) -> List[Tuple[int, bytes]]:
        """Split a secret byte string into `total_shares` shares with threshold `threshold`.
        
        Args:
            secret: Plaintext byte string to split.
            threshold: Minimum number of shares required to reconstruct (k).
            total_shares: Total number of shares to generate (n).
            
        Returns:
            List of tuples: (x_index, share_bytes) where 1 <= x_index <= total_shares.
        """
        if not secret:
            raise ValueError("Secret cannot be empty")
        if not (1 <= threshold <= total_shares <= 255):
            raise ValueError(
                f"Invalid policy parameters: threshold={threshold}, total={total_shares}. "
                "Must satisfy 1 <= threshold <= total_shares <= 255."
            )

        secret_len = len(secret)
        # Pre-allocate share buffers for x = 1 .. total_shares
        share_buffers: List[bytearray] = [bytearray(secret_len) for _ in range(total_shares)]

        # For each byte of the secret, generate a random polynomial of degree (threshold - 1)
        for byte_idx, secret_byte in enumerate(secret):
            # Constant term a_0 is the secret byte itself
            # Random coefficients a_1 ... a_{k-1} chosen uniformly from GF(2^8)
            poly_coeffs = [secret_byte] + [secrets.randbelow(256) for _ in range(threshold - 1)]

            # Evaluate polynomial at each x in 1 .. total_shares
            for i in range(total_shares):
                x = i + 1
                y = GF256.poly_eval(poly_coeffs, x)
                share_buffers[i][byte_idx] = y

        return [(i + 1, bytes(share_buffers[i])) for i in range(total_shares)]

    @classmethod
    def reconstruct_secret(
        cls,
        shares: List[Tuple[int, bytes]],
        threshold: int
    ) -> bytes:
        """Reconstruct the original secret from a subset of at least `threshold` shares.
        
        Args:
            shares: List of (x, share_bytes) tuples.
            threshold: The required threshold (k).
            
        Returns:
            The reconstructed secret as bytes.
        """
        if len(shares) < threshold:
            raise InsufficientSharesError(
                f"Insufficient shares: received {len(shares)}, but threshold is {threshold}."
            )

        # Select first threshold shares for reconstruction
        selected_shares = shares[:threshold]

        # Extract and validate x coordinates
        x_coords = [s[0] for s in selected_shares]
        
        # Check for non-zero positive bounds
        for x in x_coords:
            if not (1 <= x <= 255):
                raise IncompatibleShareError(f"Share index x={x} out of valid GF(2^8) range [1, 255]")

        # Check for duplicates
        if len(set(x_coords)) != len(x_coords):
            raise DuplicateShareError("Duplicate share indices detected; all shares must have distinct x coordinates")

        # Validate consistent share length
        share_len = len(selected_shares[0][1])
        for x, y_bytes in selected_shares:
            if len(y_bytes) != share_len:
                raise IncompatibleShareError(
                    f"Mismatched share length for share x={x}: expected {share_len}, got {len(y_bytes)}"
                )

        # Precompute Lagrange basis polynomials evaluated at x = 0
        # L_i(0) = Product_{m != i} (x_m / (x_i XOR x_m))
        lagrange_weights: List[int] = []
        for i, x_i in enumerate(x_coords):
            weight = 1
            for m, x_m in enumerate(x_coords):
                if m == i:
                    continue
                # In GF(2^8), subtraction is XOR: x_i - x_m = x_i ^ x_m
                diff = GF256.sub(x_i, x_m)
                if diff == 0:
                    raise DuplicateShareError(f"Collision in share x coordinates: {x_i} == {x_m}")
                factor = GF256.div(x_m, diff)
                weight = GF256.mul(weight, factor)
            lagrange_weights.append(weight)

        # Interpolate secret byte-by-byte
        # S_j = Sum_{i=0}^{k-1} (y_{i,j} * L_i(0))
        reconstructed = bytearray(share_len)
        for byte_idx in range(share_len):
            val = 0
            for i, (_, y_bytes) in enumerate(selected_shares):
                term = GF256.mul(y_bytes[byte_idx], lagrange_weights[i])
                val = GF256.add(val, term)
            reconstructed[byte_idx] = val

        return bytes(reconstructed)
