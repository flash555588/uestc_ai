"""add per-problem scoring configuration

Revision ID: 9d4f6a7b8c1e
Revises: 8c3e4d9f1a2b
Create Date: 2026-08-27 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "9d4f6a7b8c1e"
down_revision = "8c3e4d9f1a2b"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("problems", schema=None) as batch_op:
        batch_op.add_column(sa.Column("scoring_config", sa.JSON(), nullable=False, server_default="{}"))


def downgrade():
    with op.batch_alter_table("problems", schema=None) as batch_op:
        batch_op.drop_column("scoring_config")

