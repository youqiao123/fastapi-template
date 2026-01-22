"""Add chat messages and artifact run_id

Revision ID: b2c7f0a6c3d1
Revises: e3cb7ca2414b
Create Date: 2026-01-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b2c7f0a6c3d1"
down_revision = "e3cb7ca2414b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("artifact", sa.Column("run_id", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_artifact_run_id"), "artifact", ["run_id"], unique=False)

    op.create_table(
        "chat_message",
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("thread_id", sa.String(length=26), nullable=False),
        sa.Column("run_id", sa.String(length=64), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chat_message_user_id"), "chat_message", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_chat_message_thread_id"), "chat_message", ["thread_id"], unique=False
    )
    op.create_index(
        op.f("ix_chat_message_run_id"), "chat_message", ["run_id"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_chat_message_run_id"), table_name="chat_message")
    op.drop_index(op.f("ix_chat_message_thread_id"), table_name="chat_message")
    op.drop_index(op.f("ix_chat_message_user_id"), table_name="chat_message")
    op.drop_table("chat_message")
    op.drop_index(op.f("ix_artifact_run_id"), table_name="artifact")
    op.drop_column("artifact", "run_id")
