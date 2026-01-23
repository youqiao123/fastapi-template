"""Add chat feedback table

Revision ID: f3b17c2f0d12
Revises: b2c7f0a6c3d1
Create Date: 2026-01-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f3b17c2f0d12"
down_revision = "b2c7f0a6c3d1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_feedback",
        sa.Column("thread_id", sa.String(length=26), nullable=False),
        sa.Column("run_id", sa.String(length=64), nullable=False),
        sa.Column("rating", sa.String(length=8), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "user_id", name="ux_chat_feedback_run_user"),
    )
    op.create_index(
        op.f("ix_chat_feedback_thread_id"),
        "chat_feedback",
        ["thread_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_feedback_run_id"), "chat_feedback", ["run_id"], unique=False
    )
    op.create_index(
        op.f("ix_chat_feedback_user_id"), "chat_feedback", ["user_id"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_chat_feedback_user_id"), table_name="chat_feedback")
    op.drop_index(op.f("ix_chat_feedback_run_id"), table_name="chat_feedback")
    op.drop_index(op.f("ix_chat_feedback_thread_id"), table_name="chat_feedback")
    op.drop_table("chat_feedback")
