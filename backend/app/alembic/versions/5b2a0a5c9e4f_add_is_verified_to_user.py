"""Add is_verified to user

Revision ID: 5b2a0a5c9e4f
Revises: 6f2c0b1d1a2b
Create Date: 2025-02-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5b2a0a5c9e4f"
down_revision = "6f2c0b1d1a2b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade():
    op.drop_column("user", "is_verified")
