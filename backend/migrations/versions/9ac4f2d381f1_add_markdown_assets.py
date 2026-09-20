"""add markdown assets

Revision ID: 9ac4f2d381f1
Revises: 4c128f86fb6f
Create Date: 2026-08-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "9ac4f2d381f1"
down_revision = "4c128f86fb6f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "markdown_assets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("uploaded_by", sa.String(length=36), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("storage_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_name"),
    )
    with op.batch_alter_table("markdown_assets", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_markdown_assets_uploaded_by"), ["uploaded_by"], unique=False)


def downgrade():
    with op.batch_alter_table("markdown_assets", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_markdown_assets_uploaded_by"))
    op.drop_table("markdown_assets")
