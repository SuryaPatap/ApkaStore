from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
import bcrypt

from ..config import settings


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


# ============================================================
# JWT CONFIGURATION
# ============================================================

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = (
    settings.access_token_expire_minutes
)


# ============================================================
# CREATE ACCESS TOKEN
# ============================================================

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:

    to_encode = data.copy()

    if expires_delta:
        expire = (
            datetime.now(timezone.utc)
            + expires_delta
        )
    else:
        expire = (
            datetime.now(timezone.utc)
            + timedelta(
                minutes=ACCESS_TOKEN_EXPIRE_MINUTES
            )
        )

    to_encode.update({
        "exp": expire
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


# ============================================================
# DECODE ACCESS TOKEN
# ============================================================

def decode_access_token(token: str) -> dict:

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        return payload

    except JWTError:
        raise ValueError(
            "Invalid or expired token"
        )