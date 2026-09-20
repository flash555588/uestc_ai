"""keep one current draft per submission

Revision ID: e7b9c1d3a5f2
Revises: c6a8b2d4e1f0
Create Date: 2026-08-27 20:00:00.000000

"""
from alembic import op


revision = "e7b9c1d3a5f2"
down_revision = "c6a8b2d4e1f0"
branch_labels = None
depends_on = None


def upgrade():
    obsolete = """
        SELECT old.id
        FROM submission_versions AS old
        JOIN (
            SELECT submission_id, MAX(version) AS keep_version
            FROM submission_versions
            GROUP BY submission_id
        ) AS latest
          ON latest.submission_id = old.submission_id
        WHERE old.version <> latest.keep_version
    """
    op.execute(f"DELETE FROM reviews WHERE submission_version_id IN ({obsolete})")
    op.execute(f"DELETE FROM scores WHERE submission_version_id IN ({obsolete})")
    op.execute(f"DELETE FROM submission_assets WHERE submission_version_id IN ({obsolete})")
    op.execute(f"DELETE FROM submission_versions WHERE id IN ({obsolete})")
    op.execute("UPDATE submission_versions SET version = 1")
    op.execute("UPDATE submissions SET current_version = 1 WHERE current_version > 0")

    op.create_index("uq_submission_current_draft", "submission_versions", ["submission_id"], unique=True)


def downgrade():
    op.drop_index("uq_submission_current_draft", table_name="submission_versions")
