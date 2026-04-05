import os

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24 * 7)))
INITIAL_ADMIN_USERNAME = os.getenv("INITIAL_ADMIN_USERNAME", "admin")
INITIAL_ADMIN_PASSWORD = os.getenv("INITIAL_ADMIN_PASSWORD", "admin")

_DEFAULT_CORS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


def cors_allow_origins() -> tuple[list[str], bool]:
    """
    CORS_ORIGINS: через запятую, либо * (любой origin; без cookie — у нас JWT в заголовке).
    Возвращает (origins, allow_credentials).
    """
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw == "*":
        return ["*"], False
    if not raw:
        return list(_DEFAULT_CORS), True
    extra = [x.strip() for x in raw.split(",") if x.strip()]
    merged = list(dict.fromkeys(_DEFAULT_CORS + extra))
    return merged, True
