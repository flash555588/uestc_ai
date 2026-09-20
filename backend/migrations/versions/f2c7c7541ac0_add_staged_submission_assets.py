"""add staged submission assets

Revision ID: f2c7c7541ac0
Revises: 9ac4f2d381f1
Create Date: 2026-08-27 11:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f2c7c7541ac0"
down_revision = "9ac4f2d381f1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "staged_submission_assets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("uploaded_by", sa.String(length=36), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("storage_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_name"),
    )
    with op.batch_alter_table("staged_submission_assets", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_staged_submission_assets_uploaded_by"), ["uploaded_by"], unique=False)


def downgrade():
    with op.batch_alter_table("staged_submission_assets", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_staged_submission_assets_uploaded_by"))
    op.drop_table("staged_submission_assets")
