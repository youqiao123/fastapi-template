"""Add conversation thread table

Revision ID: b8a3f1d8c9e0
Revises: 1a31ce608336
Create Date: 2024-08-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8a3f1d8c9e0"
down_revision = "1a31ce608336"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "conversation_thread",
        sa.Column("thread_id", sa.String(length=26), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("thread_id"),
    )
    op.create_index(
        op.f("ix_conversation_thread_user_id"),
        "conversation_thread",
        ["user_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_conversation_thread_user_id"), table_name="conversation_thread")
    op.drop_table("conversation_thread")
