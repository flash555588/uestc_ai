"""bind external score batches to a problem

Revision ID: 8c3e4d9f1a2b
Revises: 75cc5a1f8e02
Create Date: 2026-08-27 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "8c3e4d9f1a2b"
down_revision = "75cc5a1f8e02"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("score_batches", schema=None) as batch_op:
        batch_op.add_column(sa.Column("problem_id", sa.String(length=36), nullable=True))
        batch_op.create_index(batch_op.f("ix_score_batches_problem_id"), ["problem_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_score_batches_problem_id_problems",
            "problems",
            ["problem_id"],
            ["id"],
        )


def downgrade():
    with op.batch_alter_table("score_batches", schema=None) as batch_op:
        batch_op.drop_constraint("fk_score_batches_problem_id_problems", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_score_batches_problem_id"))
        batch_op.drop_column("problem_id")

