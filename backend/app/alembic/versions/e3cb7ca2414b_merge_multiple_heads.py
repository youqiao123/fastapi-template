"""merge multiple heads

Revision ID: e3cb7ca2414b
Revises: 7c4b6b1f5a21, 9b8c5a1a2f4e
Create Date: 2026-01-02 17:16:53.747961

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'e3cb7ca2414b'
down_revision = ('7c4b6b1f5a21', '9b8c5a1a2f4e')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
