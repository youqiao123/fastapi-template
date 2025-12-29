"""Add email verification sent at to user

Revision ID: 9b8c5a1a2f4e
Revises: 5b2a0a5c9e4f
Create Date: 2025-02-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9b8c5a1a2f4e"
down_revision = "5b2a0a5c9e4f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user",
        sa.Column("email_verification_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("user", "email_verification_sent_at")
