"""add email verification and registration invites

Revision ID: c6a8b2d4e1f0
Revises: 9d4f6a7b8c1e
Create Date: 2026-08-27 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "c6a8b2d4e1f0"
down_revision = "9d4f6a7b8c1e"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))

    op.execute("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP")

    op.create_table(
        "email_verification_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("request_ip_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("email_verification_codes", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_email_verification_codes_created_at"), ["created_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_email_verification_codes_email"), ["email"], unique=False)
        batch_op.create_index(batch_op.f("ix_email_verification_codes_expires_at"), ["expires_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_email_verification_codes_consumed_at"), ["consumed_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_email_verification_codes_request_ip_hash"), ["request_ip_hash"], unique=False)

    op.create_table(
        "registration_invites",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("code_prefix", sa.String(length=8), nullable=False),
        sa.Column("note", sa.String(length=160), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by", sa.String(length=36), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["used_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("registration_invites", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_registration_invites_code_hash"), ["code_hash"], unique=True)
        batch_op.create_index(batch_op.f("ix_registration_invites_created_by"), ["created_by"], unique=False)
        batch_op.create_index(batch_op.f("ix_registration_invites_expires_at"), ["expires_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_registration_invites_revoked_at"), ["revoked_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_registration_invites_used_at"), ["used_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_registration_invites_used_by"), ["used_by"], unique=False)


def downgrade():
    with op.batch_alter_table("registration_invites", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_registration_invites_used_by"))
        batch_op.drop_index(batch_op.f("ix_registration_invites_used_at"))
        batch_op.drop_index(batch_op.f("ix_registration_invites_revoked_at"))
        batch_op.drop_index(batch_op.f("ix_registration_invites_expires_at"))
        batch_op.drop_index(batch_op.f("ix_registration_invites_created_by"))
        batch_op.drop_index(batch_op.f("ix_registration_invites_code_hash"))
    op.drop_table("registration_invites")

    with op.batch_alter_table("email_verification_codes", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_email_verification_codes_request_ip_hash"))
        batch_op.drop_index(batch_op.f("ix_email_verification_codes_consumed_at"))
        batch_op.drop_index(batch_op.f("ix_email_verification_codes_expires_at"))
        batch_op.drop_index(batch_op.f("ix_email_verification_codes_email"))
        batch_op.drop_index(batch_op.f("ix_email_verification_codes_created_at"))
    op.drop_table("email_verification_codes")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("email_verified_at")
