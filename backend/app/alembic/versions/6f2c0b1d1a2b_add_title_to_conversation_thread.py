"""Add title to conversation thread

Revision ID: 6f2c0b1d1a2b
Revises: c1f2c1b0e8a3
Create Date: 2025-02-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6f2c0b1d1a2b"
down_revision = "c1f2c1b0e8a3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "conversation_thread",
        sa.Column("title", sa.String(length=255), nullable=True),
    )


def downgrade():
    op.drop_column("conversation_thread", "title")
