from __future__ import annotations

import io
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from platform_api import create_app  # noqa: E402
from platform_api.extensions import db  # noqa: E402
from platform_api.models import Competition  # noqa: E402


class PlatformApiTestCase(unittest.TestCase):
    def setUp(self):
        self.runtime = tempfile.TemporaryDirectory()
        runtime_path = Path(self.runtime.name)
        database_uri = "sqlite:///" + (runtime_path / "test.sqlite3").as_posix()
        self.app = create_app({
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": database_uri,
            "UPLOAD_FOLDER": str(runtime_path / "uploads"),
            "AUTO_CREATE_SCHEMA": True,
            "SEED_DATABASE": True,
            "ENFORCE_COMPETITION_DEADLINES": False,
            "INITIAL_ADMIN_PASSWORD": "ChangeMe123!",
            "INITIAL_REVIEWER_PASSWORD": "ChangeMe123!",
        })
        self.member = self.app.test_client()
        self.reviewer = self.app.test_client()
        self.admin = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.runtime.cleanup()

    def login(self, client, email, password="ChangeMe123!"):
        response = client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def register(self, client, email, name, password="secure-pass-123", invite_code=None):
        verification_payload = {"email": email}
        if invite_code:
            verification_payload["invite_code"] = invite_code
        verification = client.post("/api/auth/verification-codes", json=verification_payload)
        self.assertEqual(verification.status_code, 202, verification.get_json())
        verification_code = verification.get_json()["debug_code"]
        register_payload = {
            "email": email,
            "name": name,
            "password": password,
            "verification_code": verification_code,
        }
        if invite_code:
            register_payload["invite_code"] = invite_code
        response = client.post("/api/auth/register", json=register_payload)
        self.assertEqual(response.status_code, 201, response.get_json())
        return response

    def test_catalog_is_database_driven(self):
        response = self.member.get("/api/competitions/2026-spring")
        self.assertEqual(response.status_code, 200)
        competition = response.get_json()
        self.assertEqual(len(competition["tracks"]), 4)
        self.assertEqual(
            {track["slug"] for track in competition["tracks"]},
            {"dl", "game-agent", "embodied-coding-ai", "ai-product-design"},
        )
        self.assertGreaterEqual(sum(len(track["problems"]) for track in competition["tracks"]), 10)

    def test_seed_requires_explicit_account_passwords(self):
        with self.assertRaisesRegex(RuntimeError, "INITIAL_ADMIN_PASSWORD"):
            create_app({
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "UPLOAD_FOLDER": str(Path(self.runtime.name) / "missing-passwords-uploads"),
                "AUTO_CREATE_SCHEMA": True,
                "SEED_DATABASE": True,
                "INITIAL_ADMIN_PASSWORD": "",
                "INITIAL_REVIEWER_PASSWORD": "",
            })

    def test_email_verification_and_external_registration_invites(self):
        campus_client = self.app.test_client()
        campus_email = "verified-student@std.uestc.edu.cn"
        verification = campus_client.post("/api/auth/verification-codes", json={"email": campus_email})
        self.assertEqual(verification.status_code, 202, verification.get_json())
        verification_code = verification.get_json()["debug_code"]

        invalid = campus_client.post("/api/auth/register", json={
            "email": campus_email,
            "name": "邮箱验证同学",
            "password": "secure-pass-123",
            "verification_code": "000000" if verification_code != "000000" else "111111",
        })
        self.assertEqual(invalid.status_code, 400, invalid.get_json())
        registered = campus_client.post("/api/auth/register", json={
            "email": campus_email,
            "name": "邮箱验证同学",
            "password": "secure-pass-123",
            "verification_code": verification_code,
        })
        self.assertEqual(registered.status_code, 201, registered.get_json())
        self.assertTrue(registered.get_json()["user"]["email_verified"])

        rate_client = self.app.test_client()
        rate_email = "rate-limit@std.uestc.edu.cn"
        first = rate_client.post("/api/auth/verification-codes", json={"email": rate_email})
        second = rate_client.post("/api/auth/verification-codes", json={"email": rate_email})
        self.assertEqual(first.status_code, 202, first.get_json())
        self.assertEqual(second.status_code, 429, second.get_json())
        self.assertGreaterEqual(second.get_json()["retry_after"], 1)

        external_client = self.app.test_client()
        external_email = "guest@example.com"
        rejected = external_client.post("/api/auth/verification-codes", json={"email": external_email})
        self.assertEqual(rejected.status_code, 403, rejected.get_json())

        self.login(self.admin, "admin@uestcai.top")
        created = self.admin.post("/api/admin/registration-invites", json={
            "note": "校外评委",
            "expires_in_days": 7,
        })
        self.assertEqual(created.status_code, 201, created.get_json())
        invite_code = created.get_json()["code"]
        external_registered = self.register(external_client, external_email, "校外评委", invite_code=invite_code)
        self.assertTrue(external_registered.get_json()["user"]["email_verified"])

        reuse = self.app.test_client().post("/api/auth/verification-codes", json={
            "email": "another-guest@example.com",
            "invite_code": invite_code,
        })
        self.assertEqual(reuse.status_code, 403, reuse.get_json())
        invite_history = self.admin.get("/api/admin/registration-invites")
        self.assertEqual(invite_history.status_code, 200, invite_history.get_json())
        self.assertEqual(invite_history.get_json()[0]["status"], "used")
        self.assertEqual(invite_history.get_json()[0]["used_by_email"], external_email)
        self.assertNotIn("code", invite_history.get_json()[0])

    def test_submission_review_score_and_leaderboard_workflow(self):
        self.register(self.member, "member@std.uestc.edu.cn", "参赛同学")

        competition = self.member.get("/api/competitions/2026-spring").get_json()
        track = next(item for item in competition["tracks"] if item["slug"] == "ai-product-design")
        problem = track["problems"][0]

        team_response = self.member.post("/api/teams", json={
            "competition_id": competition["id"],
            "name": "可复现小队",
        })
        self.assertEqual(team_response.status_code, 201, team_response.get_json())
        team = team_response.get_json()

        registration = self.member.post("/api/registrations", json={
            "competition_id": competition["id"],
            "track_id": track["id"],
            "team_id": team["id"],
            "fields": {"contact": "member@example.com"},
        })
        self.assertEqual(registration.status_code, 201, registration.get_json())
        my_registrations = self.member.get("/api/me/registrations")
        self.assertEqual(my_registrations.status_code, 200)
        self.assertEqual(my_registrations.get_json()[0]["track_name"], "AI 产品设计")

        submit = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "校园模型评测台",
            "readme_md": "# 校园模型评测台\n\n这是可以复现的作品说明。",
            "fields": {"repository": "https://example.com/repository"},
            "status": "submitted",
        })
        self.assertEqual(submit.status_code, 201, submit.get_json())
        submission = submit.get_json()
        version_id = submission["version"]["id"]

        upload = self.member.post(
            f"/api/submission-versions/{version_id}/assets",
            data={"visibility": "public", "file": (io.BytesIO(b"result"), "结果文件.csv")},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload.status_code, 201, upload.get_json())
        self.assertIsNotNone(upload.get_json()["id"])
        self.assertEqual(upload.get_json()["original_name"], "结果文件.csv")

        self.app.config["SUBMISSION_ASSET_MAX_SIZE"] = 4
        oversized_upload = self.member.post(
            f"/api/submission-versions/{version_id}/assets",
            data={"visibility": "public", "file": (io.BytesIO(b"12345"), "过大文件.csv")},
            content_type="multipart/form-data",
        )
        self.assertEqual(oversized_upload.status_code, 413)
        self.assertEqual(oversized_upload.get_json()["error"], "submission asset exceeds size limit")

        public_work = self.member.get(f"/api/works/{submission['id']}")
        self.assertEqual(public_work.status_code, 200, public_work.get_json())
        self.assertEqual(public_work.get_json()["version"]["readme_md"].splitlines()[0], "# 校园模型评测台")
        self.assertEqual(len(public_work.get_json()["assets"]), 1)

        second_version = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "校园模型评测台 2.0",
            "readme_md": "# 第二版",
            "fields": {"repository": "https://example.com/repository/v2"},
            "status": "submitted",
        })
        self.assertEqual(second_version.status_code, 201, second_version.get_json())
        self.assertEqual(second_version.get_json()["version"]["version"], 1)
        self.assertEqual(second_version.get_json()["version"]["id"], version_id)
        detail = self.member.get(f"/api/submissions/{submission['id']}").get_json()
        self.assertEqual(len(detail["versions"]), 1)
        self.assertEqual(detail["versions"][0]["readme_md"], "# 第二版")
        public_archive = self.member.get("/api/works")
        self.assertEqual(public_archive.status_code, 200, public_archive.get_json())
        archived_work = next(item for item in public_archive.get_json() if item["id"] == submission["id"])
        self.assertEqual(archived_work["title"], "校园模型评测台 2.0")
        public_detail = self.member.get(f"/api/works/{submission['id']}").get_json()
        self.assertEqual(public_detail["competition"]["id"], competition["id"])
        self.assertEqual(public_detail["track"]["id"], track["id"])
        self.assertEqual(public_detail["problem"]["id"], problem["id"])
        self.assertEqual(public_detail["team_members"][0]["name"], "参赛同学")
        self.assertNotIn("email", public_detail["team_members"][0])

        self.login(self.reviewer, "reviewer@uestc.ai")
        review_queue = self.reviewer.get("/api/review-queue")
        self.assertEqual(review_queue.status_code, 200, review_queue.get_json())
        self.assertEqual(review_queue.get_json()[0]["id"], version_id)
        self.assertEqual(review_queue.get_json()[0]["fields"]["repository"], "https://example.com/repository/v2")
        self.assertEqual(len(review_queue.get_json()[0]["assets"]), 0)
        self.assertEqual(review_queue.get_json()[0]["readme_md"], "# 第二版")
        review = self.reviewer.post("/api/reviews", json={
            "submission_version_id": version_id,
            "scores": {"engineering": 28, "completeness": 23, "idea": 18},
            "feedback_md": "结构清楚，可继续补充用户研究。",
            "status": "submitted",
        })
        self.assertEqual(review.status_code, 201, review.get_json())
        self.assertEqual(review.get_json()["total_score"], 69.0)

        self.login(self.admin, "admin@uestcai.top")
        draft_content = self.admin.post("/api/content", json={
            "kind": "announcement",
            "slug": "integration-test-draft",
            "title": "联调草稿",
            "body_md": "# 联调草稿",
            "status": "draft",
        })
        self.assertEqual(draft_content.status_code, 201, draft_content.get_json())
        public_content = self.member.get("/api/content").get_json()
        self.assertNotIn("integration-test-draft", [item["slug"] for item in public_content])
        self.assertTrue(all("body_md" not in item for item in public_content))
        managed_content = self.admin.get("/api/content?scope=all").get_json()
        managed_draft = next(item for item in managed_content if item["slug"] == "integration-test-draft")
        self.assertEqual(managed_draft["body_md"], "# 联调草稿")
        score_import = self.admin.post("/api/scores/import", json={
            "competition_id": competition["id"],
            "problem_id": problem["id"],
            "source": "final-jury",
            "label": "决赛评审第一批",
            "records": [{
                "submission_version_id": version_id,
                "metrics": {"jury": 92.5},
                "total_score": 92.5,
                "rank": 1,
            }],
        })
        self.assertEqual(score_import.status_code, 409, score_import.get_json())
        self.assertEqual(score_import.get_json()["error"], "external scoring is not enabled for this problem")

        leaderboard = self.member.get("/api/leaderboards/2026-spring?track=ai-product-design")
        self.assertEqual(leaderboard.status_code, 200)
        rows = leaderboard.get_json()
        self.assertEqual(rows[0]["team"], "可复现小队")
        self.assertEqual(rows[0]["version"], 1)
        self.assertEqual(rows[0]["total_score"], 69.0)

    def test_competition_reviewer_weights_auto_split_and_review_progress(self):
        self.register(self.member, "weighted-member@std.uestc.edu.cn", "权重测试成员")
        competition = self.member.get("/api/competitions/2026-spring").get_json()
        track = next(item for item in competition["tracks"] if item["slug"] == "ai-product-design")
        problem = track["problems"][0]
        team = self.member.post("/api/teams", json={
            "competition_id": competition["id"],
            "name": "权重测试队伍",
        }).get_json()
        self.member.post("/api/registrations", json={
            "competition_id": competition["id"],
            "track_id": track["id"],
            "team_id": team["id"],
        })
        submission = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "权重测试作品",
            "readme_md": "# 权重测试作品",
            "status": "submitted",
        }).get_json()
        version_id = submission["version"]["id"]

        self.login(self.reviewer, "reviewer@uestc.ai")
        reviewer_id = self.reviewer.get("/api/auth/me").get_json()["user"]["id"]
        self.login(self.admin, "admin@uestcai.top")
        admin_id = self.admin.get("/api/auth/me").get_json()["user"]["id"]

        initial = self.admin.get(f"/api/manage/reviewer-weights?competition_id={competition['id']}")
        self.assertEqual(initial.status_code, 200, initial.get_json())
        self.assertTrue(initial.get_json()["configured"])
        self.assertEqual(next(item for item in initial.get_json()["reviewers"] if item["id"] == reviewer_id)["effective_weight_percent"], 100.0)

        configured = self.admin.put(f"/api/manage/competitions/{competition['id']}/reviewers", json={
            "reviewers": [
                {"user_id": reviewer_id, "weight_percent": 40},
                {"user_id": admin_id, "weight_percent": None},
            ],
        })
        self.assertEqual(configured.status_code, 200, configured.get_json())
        rows = {item["id"]: item for item in configured.get_json()["reviewers"]}
        self.assertEqual(rows[reviewer_id]["effective_weight_percent"], 40.0)
        self.assertEqual(rows[admin_id]["effective_weight_percent"], 60.0)

        reviewer_queue = self.reviewer.get("/api/review-queue")
        self.assertEqual(reviewer_queue.status_code, 200, reviewer_queue.get_json())
        self.assertEqual(reviewer_queue.get_json()[0]["id"], version_id)
        self.assertEqual(reviewer_queue.get_json()[0]["reviewer_weight_percent"], 40.0)
        review = self.reviewer.post("/api/reviews", json={
            "submission_version_id": version_id,
            "scores": {"engineering": 80},
            "total_score": 80,
            "status": "submitted",
        })
        self.assertEqual(review.status_code, 201, review.get_json())

        provisional = self.admin.get(f"/api/manage/reviewer-weights?competition_id={competition['id']}").get_json()["review_summaries"][0]
        self.assertEqual(provisional["reviewed_count"], 1)
        self.assertEqual(provisional["completed_weight_percent"], 40.0)
        self.assertEqual(provisional["provisional_score"], 80.0)
        self.assertIsNone(provisional["final_score"])

        admin_queue = self.admin.get("/api/review-queue")
        self.assertEqual(admin_queue.status_code, 200, admin_queue.get_json())
        self.assertEqual(admin_queue.get_json()[0]["reviewer_weight_percent"], 60.0)
        admin_review = self.admin.post("/api/reviews", json={
            "submission_version_id": version_id,
            "scores": {"engineering": 100},
            "total_score": 100,
            "status": "submitted",
        })
        self.assertEqual(admin_review.status_code, 201, admin_review.get_json())

        final = self.admin.get(f"/api/manage/reviewer-weights?competition_id={competition['id']}").get_json()["review_summaries"][0]
        self.assertEqual(final["reviewed_count"], 2)
        self.assertEqual(final["completed_weight_percent"], 100.0)
        self.assertEqual(final["final_score"], 92.0)
        online_leaderboard = self.member.get("/api/leaderboards/2026-spring?track=ai-product-design")
        self.assertEqual(online_leaderboard.status_code, 200, online_leaderboard.get_json())
        online_rows = online_leaderboard.get_json()
        self.assertEqual(len(online_rows), 1)
        self.assertEqual(online_rows[0]["source"], "online-review")
        self.assertEqual(online_rows[0]["total_score"], 92.0)

        locked = self.admin.patch(f"/api/manage/competitions/{competition['id']}/review-lock", json={"locked": True})
        self.assertEqual(locked.status_code, 200, locked.get_json())
        self.assertTrue(locked.get_json()["locked"])
        self.assertIsNotNone(locked.get_json()["locked_at"])

        locked_queue = self.reviewer.get("/api/review-queue")
        self.assertEqual(locked_queue.status_code, 200, locked_queue.get_json())
        self.assertTrue(locked_queue.get_json()[0]["review_locked"])
        rejected_review = self.reviewer.post("/api/reviews", json={
            "submission_version_id": version_id,
            "scores": {"engineering": 70},
            "total_score": 70,
            "status": "submitted",
        })
        self.assertEqual(rejected_review.status_code, 409, rejected_review.get_json())
        self.assertEqual(rejected_review.get_json()["error"], "online review is locked for this competition")
        rejected_weights = self.admin.put(f"/api/manage/competitions/{competition['id']}/reviewers", json={
            "reviewers": [{"user_id": reviewer_id, "weight_percent": 100}],
        })
        self.assertEqual(rejected_weights.status_code, 409, rejected_weights.get_json())

        unlocked = self.admin.patch(f"/api/manage/competitions/{competition['id']}/review-lock", json={"locked": False})
        self.assertEqual(unlocked.status_code, 200, unlocked.get_json())
        self.assertFalse(unlocked.get_json()["locked"])
        updated_review = self.reviewer.post("/api/reviews", json={
            "submission_version_id": version_id,
            "scores": {"engineering": 70},
            "total_score": 70,
            "status": "submitted",
        })
        self.assertEqual(updated_review.status_code, 201, updated_review.get_json())

    def test_team_must_register_for_problem_track(self):
        self.register(self.member, "member2@std.uestc.edu.cn", "另一位同学")
        competition = self.member.get("/api/competitions/2026-spring").get_json()
        dl_track = next(item for item in competition["tracks"] if item["slug"] == "dl")
        product_track = next(item for item in competition["tracks"] if item["slug"] == "ai-product-design")
        team = self.member.post("/api/teams", json={
            "competition_id": competition["id"],
            "name": "单赛道队伍",
        }).get_json()
        self.member.post("/api/registrations", json={
            "competition_id": competition["id"],
            "track_id": dl_track["id"],
            "team_id": team["id"],
        })
        response = self.member.post("/api/submissions", json={
            "problem_id": product_track["problems"][0]["id"],
            "team_id": team["id"],
            "title": "错误赛道提交",
            "readme_md": "# README",
            "status": "submitted",
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["error"], "team is not registered for this track")

    def test_markdown_assets_are_authenticated_size_limited_and_publicly_readable(self):
        anonymous = self.member.post(
            "/api/markdown-assets",
            data={"file": (io.BytesIO(b"image"), "diagram.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(anonymous.status_code, 401)

        self.register(self.member, "markdown@std.uestc.edu.cn", "Markdown 作者")

        upload = self.member.post(
            "/api/markdown-assets",
            data={"file": (io.BytesIO(b"image"), "赛题示意图.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload.status_code, 201, upload.get_json())
        asset = upload.get_json()
        self.assertEqual(asset["kind"], "image")
        self.assertEqual(asset["original_name"], "赛题示意图.png")
        self.assertEqual(asset["url"], f"/api/markdown-assets/{asset['id']}")
        served = self.app.test_client().get(asset["url"])
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served.data, b"image")
        self.assertEqual(served.headers["X-Content-Type-Options"], "nosniff")
        served.close()

        rejected_type = self.member.post(
            "/api/markdown-assets",
            data={"file": (io.BytesIO(b"binary"), "program.exe")},
            content_type="multipart/form-data",
        )
        self.assertEqual(rejected_type.status_code, 400)
        self.assertEqual(rejected_type.get_json()["error"], "markdown asset type is not allowed")

        self.app.config["MARKDOWN_ASSET_MAX_SIZE"] = 4
        rejected_size = self.member.post(
            "/api/markdown-assets",
            data={"file": (io.BytesIO(b"12345"), "large.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(rejected_size.status_code, 413)
        self.assertEqual(rejected_size.get_json()["error"], "markdown asset exceeds size limit")

    def test_submission_assets_stage_immediately_and_carry_into_new_drafts(self):
        self.register(self.member, "staged-assets@std.uestc.edu.cn", "附件流程测试成员")
        competition = self.member.get("/api/competitions/2026-spring").get_json()
        track = next(item for item in competition["tracks"] if item["slug"] == "ai-product-design")
        problem = track["problems"][0]
        team = self.member.post("/api/teams", json={
            "competition_id": competition["id"],
            "name": "附件流程小队",
        }).get_json()
        self.member.post("/api/registrations", json={
            "competition_id": competition["id"],
            "track_id": track["id"],
            "team_id": team["id"],
        })

        staged = self.member.post(
            "/api/submission-assets/stage",
            data={"file": (io.BytesIO(b"draft image"), "草稿截图.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(staged.status_code, 201, staged.get_json())
        staged_asset = staged.get_json()

        first = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "附件草稿",
            "readme_md": "# 第一版草稿",
            "status": "draft",
            "staged_asset_ids": [staged_asset["id"]],
        })
        self.assertEqual(first.status_code, 201, first.get_json())
        first_data = first.get_json()
        self.assertEqual(len(first_data["version"]["assets"]), 1)
        first_asset = first_data["version"]["assets"][0]
        self.assertEqual(first_asset["original_name"], "草稿截图.png")
        self.assertEqual(self.member.delete(f"/api/submission-assets/stage/{staged_asset['id']}").status_code, 404)

        second = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "附件草稿",
            "readme_md": "# 第二版草稿",
            "status": "draft",
            "retained_asset_ids": [first_asset["id"]],
        })
        self.assertEqual(second.status_code, 201, second.get_json())
        second_data = second.get_json()
        self.assertEqual(len(second_data["version"]["assets"]), 1)
        self.assertEqual(second_data["version"]["assets"][0]["id"], first_asset["id"])

        formal = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "附件正式版",
            "readme_md": "# 正式版",
            "status": "submitted",
            "retained_asset_ids": [second_data["version"]["assets"][0]["id"]],
        })
        self.assertEqual(formal.status_code, 201, formal.get_json())
        self.assertEqual(len(formal.get_json()["version"]["assets"]), 1)

        self.login(self.reviewer, "reviewer@uestc.ai")
        review = self.reviewer.post("/api/reviews", json={
            "submission_version_id": formal.get_json()["version"]["id"],
            "scores": {"engineering": 80},
            "status": "submitted",
        })
        self.assertEqual(review.status_code, 201, review.get_json())

        later_draft = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "下一版草稿",
            "readme_md": "# 下一版草稿",
            "status": "draft",
        })
        self.assertEqual(later_draft.status_code, 201, later_draft.get_json())
        self.assertEqual(later_draft.get_json()["status"], "draft")
        self.assertEqual(later_draft.get_json()["latest_version_status"], "draft")
        public_work = self.member.get(f"/api/works/{first_data['id']}")
        self.assertEqual(public_work.status_code, 404, public_work.get_json())

        restored = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "最终正式稿",
            "readme_md": "# 最终正式稿",
            "status": "submitted",
        })
        self.assertEqual(restored.status_code, 201, restored.get_json())
        queue = self.reviewer.get("/api/review-queue").get_json()
        queue_item = next(item for item in queue if item["id"] == restored.get_json()["version"]["id"])
        self.assertIsNone(queue_item["my_review"])

        with self.app.app_context():
            stored_competition = db.session.get(Competition, competition["id"])
            stored_competition.ends_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            db.session.commit()
        self.app.config["ENFORCE_COMPETITION_DEADLINES"] = True
        after_deadline = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "截止后修改",
            "readme_md": "# 不应保存",
            "status": "draft",
        })
        self.assertEqual(after_deadline.status_code, 409, after_deadline.get_json())
        self.assertEqual(after_deadline.get_json()["error"], "submission deadline has passed")

    def test_management_deletes_empty_records_and_preserves_participation_history(self):
        self.login(self.admin, "admin@uestcai.top")
        competition_response = self.admin.post("/api/competitions", json={
            "slug": "delete-test",
            "name": "可删除测试赛事",
            "summary": "没有报名记录的赛事",
            "status": "draft",
        })
        self.assertEqual(competition_response.status_code, 201, competition_response.get_json())
        competition = competition_response.get_json()
        track_response = self.admin.post("/api/competitions/delete-test/tracks", json={
            "slug": "empty-track",
            "name": "空赛道",
            "description": "没有参赛记录",
        })
        self.assertEqual(track_response.status_code, 201, track_response.get_json())
        track = track_response.get_json()
        problem_response = self.admin.post(f"/api/tracks/{track['id']}/problems", json={
            "code": "DEL-001",
            "slug": "empty-problem",
            "title": "空赛题",
            "statement_md": "# 空赛题",
            "status": "draft",
        })
        self.assertEqual(problem_response.status_code, 201, problem_response.get_json())
        problem = problem_response.get_json()

        self.assertEqual(self.admin.delete(f"/api/manage/problems/{problem['id']}").status_code, 204)
        self.assertEqual(self.admin.delete(f"/api/manage/tracks/{track['id']}").status_code, 204)
        self.assertEqual(self.admin.delete(f"/api/manage/competitions/{competition['id']}").status_code, 204)

        content = self.admin.post("/api/content", json={
            "kind": "blog",
            "slug": "delete-content-test",
            "title": "待删除内容",
            "body_md": "# 待删除内容",
            "status": "draft",
        }).get_json()
        self.assertEqual(self.admin.delete(f"/api/content/{content['id']}").status_code, 204)
        self.assertEqual(self.admin.get("/api/content/delete-content-test").status_code, 404)

        protected_competition = self.admin.get("/api/competitions/2026-spring").get_json()
        protected_track = protected_competition["tracks"][0]
        protected_problem = protected_track["problems"][0]
        self.admin.post("/api/auth/logout")
        self.register(self.member, "delete-protection@std.uestc.edu.cn", "记录保护测试成员")
        team = self.member.post("/api/teams", json={
            "competition_id": protected_competition["id"],
            "name": "不可删除记录队伍",
        }).get_json()
        self.member.post("/api/registrations", json={
            "competition_id": protected_competition["id"],
            "track_id": protected_track["id"],
            "team_id": team["id"],
        })
        submission = self.member.post("/api/submissions", json={
            "problem_id": protected_problem["id"],
            "team_id": team["id"],
            "title": "受保护作品",
            "readme_md": "# 受保护作品",
            "status": "submitted",
        })
        self.assertEqual(submission.status_code, 201, submission.get_json())

        self.login(self.admin, "admin@uestcai.top")
        problem_delete = self.admin.delete(f"/api/manage/problems/{protected_problem['id']}")
        track_delete = self.admin.delete(f"/api/manage/tracks/{protected_track['id']}")
        competition_delete = self.admin.delete(f"/api/manage/competitions/{protected_competition['id']}")
        self.assertEqual(problem_delete.status_code, 409)
        self.assertEqual(problem_delete.get_json()["error"], "problem has submissions")
        self.assertEqual(track_delete.status_code, 409)
        self.assertEqual(track_delete.get_json()["error"], "track has participation records")
        self.assertEqual(competition_delete.status_code, 409)
        self.assertEqual(competition_delete.get_json()["error"], "competition has participation records")

    def test_member_can_remove_only_uncommitted_participation_records(self):
        self.login(self.admin, "admin@uestcai.top")
        competition = self.admin.post("/api/competitions", json={
            "slug": "member-delete-test",
            "name": "成员删除测试赛事",
            "summary": "测试草稿和报名删除",
            "status": "published",
        }).get_json()
        track = self.admin.post("/api/competitions/member-delete-test/tracks", json={
            "slug": "member-track",
            "name": "成员测试赛道",
        }).get_json()
        problem = self.admin.post(f"/api/tracks/{track['id']}/problems", json={
            "code": "MEM-001",
            "slug": "member-problem",
            "title": "成员测试赛题",
            "statement_md": "# 成员测试赛题",
            "status": "published",
        }).get_json()

        self.register(self.member, "member-delete@std.uestc.edu.cn", "草稿清理成员")
        team = self.member.post("/api/teams", json={
            "competition_id": competition["id"],
            "name": "草稿清理队伍",
        }).get_json()
        registration = self.member.post("/api/registrations", json={
            "competition_id": competition["id"],
            "track_id": track["id"],
            "team_id": team["id"],
        }).get_json()
        draft = self.member.post("/api/submissions", json={
            "problem_id": problem["id"],
            "team_id": team["id"],
            "title": "待删除草稿",
            "readme_md": "# 待删除草稿",
            "status": "draft",
        }).get_json()

        my_submissions = self.member.get("/api/me/submissions")
        self.assertEqual(my_submissions.status_code, 200)
        self.assertEqual(my_submissions.get_json()[0]["problem_slug"], "member-problem")
        draft_detail = self.member.get(f"/api/submissions/{draft['id']}")
        self.assertEqual(draft_detail.status_code, 200)
        self.assertEqual(draft_detail.get_json()["versions"][-1]["readme_md"], "# 待删除草稿")

        self.assertEqual(self.member.delete(f"/api/registrations/{registration['id']}").status_code, 409)
        self.assertEqual(self.member.delete(f"/api/submissions/{draft['id']}").status_code, 204)
        self.assertEqual(self.member.delete(f"/api/registrations/{registration['id']}").status_code, 204)
        self.assertEqual(self.member.delete(f"/api/teams/{team['id']}").status_code, 204)


if __name__ == "__main__":
    unittest.main()
