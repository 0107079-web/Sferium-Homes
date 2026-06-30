import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from backend.config import settings

logger = logging.getLogger("sferium.db")

# Async SQLAlchemy Engine setup with connection pool optimization
engine = create_async_engine(
    settings.postgres_url,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    echo=settings.DEBUG
)

# Async Session Factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency injector for async database sessions.
    Handles automatic cleanup, commit, or rollback on unhandled exceptions.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            logger.error(f"Transaction failed. Rolling back session. Error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db() -> None:
    """
    Bootstrap schema in the target PostgreSQL instance.
    Uses async engine metadata bound schemas.
    """
    try:
        async with engine.begin() as conn:
            # Create tables if not exists
            await conn.run_sync(Base.metadata.create_all)
        logger.info("📡 PostgreSQL database schemas initialized successfully!")
    except Exception as e:
        logger.error(f"❌ Failed to bootstrap PostgreSQL tables: {e}")
        # In a robust production environment, we do not crash here if the database is temporarily offline,
        # allowing fallback to in-memory mocks
