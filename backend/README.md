# UESTC AI 社 Flask API

后端负责赛事、题目、报名提交、作品快照、评审成绩和资讯内容的记录与流转。它不会执行参赛代码，也不包含外部评测服务。

## 本地运行

先在仓库根目录复制 `.env.example` 为 `.env`，再运行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python backend/app.py
```

API 默认监听 `http://127.0.0.1:5000`，健康检查位于 `GET /api/health`。

## 配置

| 环境变量 | 用途 | 生产要求 |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy 数据库 URL | 使用 PostgreSQL |
| `SECRET_KEY` | 验证码散列与 Flask 密钥 | 使用长随机值 |
| `CORS_ORIGINS` | 逗号分隔的允许来源 | 设置精确 HTTPS 来源 |
| `SESSION_COOKIE_SECURE` | 仅通过 HTTPS 发送会话 Cookie | 设为 `1` |
| `SESSION_COOKIE_SAMESITE` | 会话 Cookie SameSite 策略 | 按部署拓扑设置 |
| `AUTO_CREATE_SCHEMA` | 启动时调用 `db.create_all()` | 设为 `0` |
| `SEED_DATABASE` | 写入演示赛事和账户 | 设为 `0` |
| `INITIAL_ADMIN_*` | 演示管理员邮箱和密码 | 初始化后移除 |
| `INITIAL_REVIEWER_*` | 演示评委邮箱和密码 | 初始化后移除 |
| `ENFORCE_COMPETITION_DEADLINES` | 强制报名和提交截止时间 | 设为 `1` |
| `RESEND_API_KEY` | Resend 邮件服务凭据 | 通过密钥服务注入 |
| `RESEND_FROM` | 验证邮件发件人 | 使用已验证域名 |
| `EXPOSE_VERIFICATION_CODE` | 在 API 响应中返回验证码 | 设为 `0` |

未设置 `AUTO_CREATE_SCHEMA` 和 `SEED_DATABASE` 时，两者默认关闭。启用演示数据时必须同时提供 `INITIAL_ADMIN_PASSWORD` 与 `INITIAL_REVIEWER_PASSWORD`。

## 数据库

本地模板使用 SQLite，生产环境建议使用 PostgreSQL，并通过 Flask-Migrate（Alembic）管理结构：

```bash
python -m flask --app backend/app.py db upgrade
```

生产环境不应依赖自动建表。修改模型后生成迁移，并在提交前检查升级和回滚逻辑。

## 邮件与注册

校内邮箱可以请求验证码注册，校外邮箱需要管理员生成的一次性邀请。没有配置 `RESEND_API_KEY` 时邮件不会发送；只有测试或明确设置 `EXPOSE_VERIFICATION_CODE=1` 的本地环境才会在响应中返回验证码。

## 上传与评分

Markdown 编辑器的单个资源默认限制为 8 MB，作品附件默认限制为 20 MB。后端会校验文件类型和大小，但生产部署仍应增加恶意文件扫描、对象存储权限和保留策略。

外部评测方可以调用 `POST /api/scores/import`。CSV 接口为 `POST /api/scores/import-csv`，multipart 字段包括 `competition_id`、`problem_id`、`source`、`label` 和 `file`。CSV 必填列为 `submission_version_id,total_score`，可选列为 `metric_<name>` 与 `feedback_md`。

平台拒绝草稿版本和跨题目成绩。公开榜单在赛事 `ends_at` 前不会返回成绩；赛事结束后，只有外部评分与在线评审满足当前权重配置的作品才进入最终排名。
