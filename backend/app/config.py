from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    database_url: str = "postgresql+psycopg://local_store_app:MyPass%402026@localhost:5432/local_store"

    secret_key: str = "default-apka-store-secret-jwt-key-2026"

    access_token_expire_minutes: int = 10080

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()