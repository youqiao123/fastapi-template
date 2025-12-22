"""Add metadata to conversation thread

Revision ID: c1f2c1b0e8a3
Revises: b8a3f1d8c9e0
Create Date: 2025-02-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c1f2c1b0e8a3"
down_revision = "b8a3f1d8c9e0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "conversation_thread",
        sa.Column("metadata", sa.JSON(), nullable=True),
    )


def downgrade():
    op.drop_column("conversation_thread", "metadata")
