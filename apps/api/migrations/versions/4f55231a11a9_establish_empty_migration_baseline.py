"""Establish empty migration baseline

Revision ID: 4f55231a11a9
Revises:
Create Date: 2026-10-03 17:37:26.029385

"""

from collections.abc import Sequence

revision: str = "4f55231a11a9"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Establish revision history; application tables belong to later tasks."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
