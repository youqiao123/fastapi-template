"""Add artifacts table

Revision ID: 7c4b6b1f5a21
Revises: 5b2a0a5c9e4f
Create Date: 2025-03-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7c4b6b1f5a21"
down_revision = "5b2a0a5c9e4f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "artifact",
        sa.Column("type", sa.String(length=255), nullable=False),
        sa.Column("path", sa.String(length=255), nullable=False),
        sa.Column("asset_id", sa.String(length=255), nullable=False),
        sa.Column("is_folder", sa.Boolean(), nullable=False),
        sa.Column("thread_id", sa.String(length=26), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_artifact_user_id"), "artifact", ["user_id"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_artifact_user_id"), table_name="artifact")
    op.drop_table("artifact")
