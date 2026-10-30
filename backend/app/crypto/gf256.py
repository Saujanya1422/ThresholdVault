"""Galois Field GF(2^8) Arithmetic Engine.

Implements finite field arithmetic over GF(2^8) with the Rijndael / AES
irreducible reduction polynomial:
    P(x) = x^8 + x^4 + x^3 + x + 1  (0x11B)

Uses generator alpha = 3 to construct log and exp tables for O(1)
multiplication and inversion.
"""

from typing import List

class GF256:
    """Finite field arithmetic over GF(2^8)."""
    
    POLYNOMIAL = 0x11B  # x^8 + x^4 + x^3 + x + 1
    EXP_TABLE: List[int] = [0] * 512
    LOG_TABLE: List[int] = [0] * 256
    _INITIALIZED = False

    @classmethod
    def _initialize_tables(cls) -> None:
        if cls._INITIALIZED:
            return
        
        # Generator alpha = 3
        # We compute powers of alpha modulo POLYNOMIAL
        x = 1
        for i in range(255):
            cls.EXP_TABLE[i] = x
            cls.EXP_TABLE[i + 255] = x
            cls.LOG_TABLE[x] = i
            # multiply x by 3 = (x << 1) ^ x
            # in polynomial form: 3*x = x*2 + x
            x2 = (x << 1)
            if x2 & 0x100:
                x2 ^= cls.POLYNOMIAL
            x = x2 ^ x

        cls.EXP_TABLE[510] = cls.EXP_TABLE[0]
        cls.EXP_TABLE[511] = cls.EXP_TABLE[1]
        cls._INITIALIZED = True

    @classmethod
    def add(cls, a: int, b: int) -> int:
        """Addition in GF(2^8) is bitwise XOR."""
        return (a ^ b) & 0xFF

    @classmethod
    def sub(cls, a: int, b: int) -> int:
        """Subtraction in GF(2^8) is identical to addition (bitwise XOR)."""
        return (a ^ b) & 0xFF

    @classmethod
    def mul(cls, a: int, b: int) -> int:
        """Multiplication in GF(2^8) using precomputed log/exp tables."""
        if not cls._INITIALIZED:
            cls._initialize_tables()
        if a == 0 or b == 0:
            return 0
        log_sum = cls.LOG_TABLE[a & 0xFF] + cls.LOG_TABLE[b & 0xFF]
        return cls.EXP_TABLE[log_sum]

    @classmethod
    def div(cls, a: int, b: int) -> int:
        """Division in GF(2^8): a / b. Raises ZeroDivisionError if b == 0."""
        if not cls._INITIALIZED:
            cls._initialize_tables()
        if b == 0:
            raise ZeroDivisionError("Division by zero in GF(2^8)")
        if a == 0:
            return 0
        log_diff = (cls.LOG_TABLE[a & 0xFF] - cls.LOG_TABLE[b & 0xFF] + 255) % 255
        return cls.EXP_TABLE[log_diff]

    @classmethod
    def inv(cls, a: int) -> int:
        """Multiplicative inverse in GF(2^8). Raises ZeroDivisionError if a == 0."""
        if not cls._INITIALIZED:
            cls._initialize_tables()
        if a == 0:
            raise ZeroDivisionError("Zero has no multiplicative inverse in GF(2^8)")
        log_val = cls.LOG_TABLE[a & 0xFF]
        return cls.EXP_TABLE[(255 - log_val) % 255]

    @classmethod
    def poly_eval(cls, poly_coeffs: List[int], x: int) -> int:
        """Evaluate polynomial with coefficients [a_0, a_1, ..., a_{k-1}] at point x.
        
        P(x) = a_0 + a_1*x + a_2*x^2 + ... + a_{k-1}*x^{k-1}
        Uses Horner's method in GF(2^8).
        """
        if not poly_coeffs:
            return 0
        if x == 0:
            return poly_coeffs[0]
        
        # Horner's method: (((a_{k-1} * x + a_{k-2}) * x + ...) * x + a_0)
        res = 0
        for coeff in reversed(poly_coeffs):
            res = cls.add(cls.mul(res, x), coeff)
        return res


# Initialize tables at import time
GF256._initialize_tables()
