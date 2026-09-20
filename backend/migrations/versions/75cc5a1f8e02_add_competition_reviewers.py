"""add competition reviewers

Revision ID: 75cc5a1f8e02
Revises: f2c7c7541ac0
Create Date: 2026-08-27 13:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "75cc5a1f8e02"
down_revision = "f2c7c7541ac0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "competition_reviewers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("competition_id", sa.String(length=36), nullable=False),
        sa.Column("reviewer_id", sa.String(length=36), nullable=False),
        sa.Column("weight_percent", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["competition_id"], ["competitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("competition_id", "reviewer_id"),
    )
    with op.batch_alter_table("competition_reviewers", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_competition_reviewers_competition_id"), ["competition_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_competition_reviewers_reviewer_id"), ["reviewer_id"], unique=False)


def downgrade():
    with op.batch_alter_table("competition_reviewers", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_competition_reviewers_reviewer_id"))
        batch_op.drop_index(batch_op.f("ix_competition_reviewers_competition_id"))
    op.drop_table("competition_reviewers")
