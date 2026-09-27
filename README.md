# 电子科技大学 AI 社平台

电子科技大学 AI 社的信息发布与通用比赛平台。项目围绕“赛事 -> 赛道 -> 题目 -> 版本提交”组织业务，同时提供组队报名、作品页、人工评审、外部成绩导入、榜单和 Markdown 内容发布。

平台只负责业务数据和材料流转，不运行参赛代码、模型或评测环境。项目仍处于早期阶段，公开部署前请完整阅读 [安全策略](SECURITY.md)。

## 主要功能

- 公开访问：赛事、赛道、题面、资讯、作品 README 和榜单
- 参赛者：注册登录、组队、报名、动态提交表单、附件和版本历史
- 评委：评审队列、动态 rubric、分项评分与反馈
- 编辑：公告、博客、调研和活动内容的草稿与发布
- 主办方：JSON/CSV 外部成绩导入、批次记录和审计记录

成绩导入绑定 `submission_version_id`。同一作品的后续提交生成新版本，不覆盖已经评审或导入成绩的旧版本。

## 技术栈

| 区域 | 技术 |
| --- | --- |
| 前端 | vinext、React 19、Next App Router、Tailwind CSS 4、TypeScript |
| 后端 | Flask 3、SQLAlchemy 2、Flask-Migrate |
| 数据库 | 本地 SQLite；生产环境 PostgreSQL |
| 内容 | `@uiw/react-md-editor`、`react-markdown`、GFM、HTML 白名单清洗 |
| 部署 | Cloudflare Worker 兼容的前端构建；Flask API 独立部署 |

四条 2026 春季赛赛道来自演示数据，前后端没有把赛道名称写死在业务逻辑中。后续赛事可以配置其他赛道、提交字段和评分 rubric。

## 本地开发

### 环境要求

- Node.js 24.19.0（本项目已验证的构建版本；Windows 上 Node.js 25.2.1 会在 RSC 构建阶段异常退出）
- pnpm 10.18.2
- Python 3.11 或更高版本

### 1. 准备配置

在仓库根目录复制环境变量模板：

```powershell
Copy-Item .env.example .env
```

macOS 或 Linux：

```bash
cp .env.example .env
```

模板只包含本地开发值。不要把 `.env` 提交到版本库，也不要把其中的演示密码用于可访问的部署。

### 2. 安装依赖

```bash
pnpm install
python -m venv .venv
```

激活 Python 虚拟环境并安装后端依赖：

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
```

macOS 或 Linux：

```bash
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

### 3. 启动服务

在两个终端中分别运行：

```bash
python backend/app.py
```

```bash
pnpm dev
```

默认地址：

- 前端：`http://127.0.0.1:30011`
- Flask API：`http://127.0.0.1:5000/api`
- 健康检查：`http://127.0.0.1:5000/api/health`

复制 `.env.example` 后，首次启动会自动建表并写入演示数据。管理员和评委账号由 `.env` 中的 `INITIAL_ADMIN_*`、`INITIAL_REVIEWER_*` 配置。未配置邮件服务时，开发环境会在验证码接口响应中返回验证码；生产环境必须关闭这一行为。

## 数据库迁移

初始 Alembic 迁移位于 `backend/migrations/versions/`。生产部署应关闭自动建表和演示数据，再执行迁移：

```bash
python -m flask --app backend/app.py db upgrade
```

修改 ORM 模型后生成并检查迁移：

```bash
python -m flask --app backend/app.py db migrate -m "describe change"
python -m flask --app backend/app.py db upgrade
```

后端配置与接口说明见 [backend/README.md](backend/README.md)。

## 验证

```bash
pnpm lint
pnpm test
python -m unittest discover -s tests -p "test_backend_api.py" -v
```

持续集成会在 Pull request 和 `main` 分支推送时运行相同检查。

## 项目结构

```text
app/                         前端路由、组件与客户端 API
backend/platform_api/        Flask 应用、模型和业务路由
backend/migrations/          Alembic 数据库迁移
public/                      前端静态资源
tests/                       前后端回归测试
worker/                      Cloudflare Worker 入口
.openai/hosting.json         Sites 前端托管配置
```

前端部署不会自动部署 Flask API。构建前应通过 `NEXT_PUBLIC_API_URL` 指向单独部署的后端，并按 [安全策略](SECURITY.md#部署基线) 配置数据库、跨域、Cookie、邮件和上传存储。

## 参与贡献

提交 issue 或 Pull request 前请阅读 [贡献指南](CONTRIBUTING.md)。安全问题请按 [安全策略](SECURITY.md) 私密报告。

## 许可证

软件代码采用 [MIT License](LICENSE)。电子科技大学名称、校徽及其他学校标识不随代码许可证授权，详见 [资产与标识许可](ASSET_LICENSES.md)。
