import os
import time

_CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_ULID_LENGTH = 26


def generate_ulid() -> str:
    """Generate a ULID string (26 chars, Crockford base32)."""
    timestamp_ms = int(time.time() * 1000)
    if timestamp_ms >= 1 << 48:
        raise ValueError("Timestamp out of range for ULID")
    random_bytes = os.urandom(10)
    value = (timestamp_ms << 80) | int.from_bytes(random_bytes, "big")
    chars: list[str] = []
    for _ in range(_ULID_LENGTH):
        chars.append(_CROCKFORD_ALPHABET[value & 0x1F])
        value >>= 5
    return "".join(reversed(chars))
