from __future__ import annotations

from datetime import datetime, timezone

from flask import current_app
from werkzeug.security import generate_password_hash

from .extensions import db
from .models import Competition, CompetitionReviewer, Content, Problem, Track, User


def seed_database() -> None:
    if Competition.query.first():
        return
    now = datetime.now(timezone.utc)
    admin_email = current_app.config["INITIAL_ADMIN_EMAIL"].strip().lower()
    admin_password = current_app.config["INITIAL_ADMIN_PASSWORD"]
    reviewer_email = current_app.config["INITIAL_REVIEWER_EMAIL"].strip().lower()
    reviewer_password = current_app.config["INITIAL_REVIEWER_PASSWORD"]
    if not admin_password or not reviewer_password:
        raise RuntimeError(
            "INITIAL_ADMIN_PASSWORD and INITIAL_REVIEWER_PASSWORD are required "
            "when SEED_DATABASE=1"
        )
    admin = User(email=admin_email, name="AI 社管理员", password_hash=generate_password_hash(admin_password), role="admin", email_verified_at=now)
    reviewer = User(email=reviewer_email, name="赛事评委", password_hash=generate_password_hash(reviewer_password), role="reviewer", email_verified_at=now)
    competition = Competition(
        slug="2026-spring", name="2026 春季赛",
        summary="四条赛道，一次公开的实验。从 baseline、Agent 到真正可运行的 AI 产品。",
        status="published", registration_opens_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        registration_closes_at=datetime(2026, 4, 12, tzinfo=timezone.utc),
        starts_at=datetime(2026, 4, 18, tzinfo=timezone.utc), ends_at=datetime(2026, 5, 24, tzinfo=timezone.utc),
        config={"team_size": {"min": 1, "max": 4}, "submission_limit": 10, "leaderboard": {"visible": True}},
    )
    db.session.add_all([admin, reviewer, competition])
    db.session.flush()
    db.session.add(CompetitionReviewer(competition=competition, reviewer=reviewer, weight_percent=None))
    track_defs = [
        ("dl", "DL / 深度学习", "从视觉、时序和多模态数据中建立可复现的模型方案。", {"accent": "coral", "short": "DL"}),
        ("game-agent", "Game Agent", "在开放世界中观察、规划、生成技能并持续恢复。", {"accent": "ink", "short": "AG"}),
        ("embodied-coding-ai", "Embodied Coding AI", "让视觉理解、代码生成和机械臂控制形成闭环。", {"accent": "sage", "short": "EC"}),
        ("ai-product-design", "AI 产品设计", "从真实需求出发，交付能被使用、被验证的 AI 产品。", {"accent": "sand", "short": "PD"}),
    ]
    tracks = {}
    for position, (slug, name, description, config) in enumerate(track_defs, 1):
        track = Track(competition=competition, slug=slug, name=name, description=description, config=config, position=position)
        tracks[slug] = track
        db.session.add(track)
    db.session.flush()
    problem_defs = [
        ("dl", "DL-001", "depth-action-recognition", "基于深度图像的日常行为识别", "使用非 RGB 深度数据识别 40 种日常动作。", 3, "单张 T4 16 GB 可完成", "candidate", ["repository", "prediction_file", "report"], {"accuracy": 1.0}),
        ("dl", "DL-002", "solar-filament-segmentation", "太阳观测图像中的暗条区域自动分割", "对 2048×2048 H-Alpha 图像输出暗条分割掩码。", 3, "单张 T4 16 GB，baseline 约 2.5 小时", "candidate", ["repository", "prediction_file", "report"], {"dice": 1.0}),
        ("dl", "DL-003", "wildlife-classification", "红外相机野生动物八分类", "识别七类野生动物与空画面，以 Log Loss 评分。", 2, "CPU 可跑通，8–16 GB GPU 调参", "candidate", ["repository", "prediction_file"], {"log_loss": -1.0}),
        ("dl", "DL-004", "brain-scan-classification", "脑部扫描正常/异常分类", "基于 NIfTI 医学影像建立可复现的分类方案。", 4, "2D 投影可用 T4；3D CNN 需要更高显存", "candidate", ["repository", "model_link", "report"], {"accuracy": 1.0}),
        ("dl", "DL-005", "ultrasound-muscle-regression", "超声肌肉参数预测", "同时预测角度、长度和厚度三个连续参数。", 3, "单张 T4 足够", "candidate", ["repository", "prediction_file"], {"mae": -1.0}),
        ("dl", "DL-006", "soil-grain-distribution", "土壤粒径分布预测", "由图像预测累计粒径分布并满足分布约束。", 3, "CPU 可做特征 baseline；T4 可训练 CNN", "candidate", ["repository", "prediction_file"], {"mae": -1.0}),
        ("dl", "DL-007", "knee-abnormality", "膝关节异常识别", "结合 MRI 切片与临床信息完成多标签识别。", 5, "建议服务器 GPU 与大容量存储", "candidate", ["repository", "model_link", "report"], {"auc": 1.0}),
        ("game-agent", "AG-001", "minecraft-survival-agent", "一小时生存：Minecraft Agent", "在隐藏种子中持续观察、规划、执行技能并发展。", 4, "外部 MineDojo 环境，平台仅交换结果", "published", ["repository", "agent_package", "report"], {"external_score": 1.0}),
        ("embodied-coding-ai", "EC-001", "robot-code-policy", "视觉机械臂 Agent", "根据自然语言与视觉观察生成可执行策略，完成组合操作。", 4, "外部 robosuite/MuJoCo 环境", "published", ["repository", "policy_package", "report"], {"success_rate": 0.7, "efficiency": 0.3}),
        ("ai-product-design", "PD-001", "open-ai-product", "基于 AIGC 与 LLM API 的自由产品开发", "工具、游戏、校园服务、Agent、插件或其他可运行产品。", 3, "主办方提供模型 API，本地无需训练", "published", ["repository", "demo_url", "demo_video", "readme"], {"engineering": 0.3, "completeness": 0.25, "idea": 0.2, "motivation": 0.1, "talk": 0.15}),
    ]
    for track_slug, code, slug, title, summary, difficulty, compute, status, fields, rubric in problem_defs:
        statement = f"# {title}\n\n{summary}\n\n## 提交要求\n\n作品必须包含 README 说明、复现步骤和 AI 工具使用声明。平台不会运行参赛代码，外部评测结果将按提交版本回传。"
        db.session.add(Problem(track=tracks[track_slug], code=code, slug=slug, title=title, summary=summary, difficulty=difficulty, compute_note=compute, status=status, statement_md=statement, submission_schema={"fields": fields, "readme_required": True}, judging_schema={"rubric": rubric}, scoring_config={"external_weight_percent": 100 if track_slug == "game-agent" else 0}))
    content_items = [
        ("announcement", "2026-spring-open", "2026 春季赛正式开放报名", "四条赛道现已开放，报名与组队截止到 4 月 12 日。"),
        ("research", "why-non-rgb-action", "为什么我们把非 RGB 行为识别放进题库", "从隐私、低照度与多传感器融合重新理解感知。"),
        ("blog", "from-baseline-to-problem", "从 Kaggle baseline 到可以被复现的赛题", "一份 notebook 如何成为规则清晰、结果可信的社内赛题。"),
    ]
    for kind, slug, title, excerpt in content_items:
        db.session.add(Content(kind=kind, slug=slug, title=title, excerpt=excerpt, body_md=f"# {title}\n\n{excerpt}\n\n本文由电子科技大学 AI 社赛事组整理。", status="published", author=admin, published_at=now))
    db.session.commit()
