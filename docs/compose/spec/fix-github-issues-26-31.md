---
feature: fix-github-issues-26-31
status: delivered
updated: 2026-10-16
branch: fix/github-issues-26-31
commits: 222fc8d..<uncommitted-worktree>
---

# 修复 GitHub Issues #26–#31

## Report

**What was built** — 修复了 5 个 GitHub issue（#26/#27/#28/#30/#31）；#29 按用户要求本轮暂缓。#28 在后端 `auth.py` 引入学号邮箱规则（`^\d{8,12}@std\.uestc\.edu\.cn$` 才可免邀请码注册），前端登录页同步判定。#31 让数字验证码在发送邮件验证码后不再被清空，文案区分两类验证码。#27 将赛题文档中「题目资源面板」统一为「API 平台」（保留原名括号说明），并补充 `memory`/`same-test-only` 字段说明。#30 赛道 banner 改用 `aspect-ratio:16/9` + `object-fit:contain` 避免挤压，并覆盖真实的 `.track-directory > a` 选择器。#26 首页 featured/blog 卡片补内边距、改用 `var(--surface)` 背景与统一圆角。

**Verification** — `pnpm exec tsc --noEmit` PASS；`tests.test_community_accounts`（11，含 3 个新增学号回归）、`tests.test_backend_api`+`test_mail_settings`（47）、`tests.test_api_surface`（2）、`tests.test_evaluation_limits`+`test_participant_journey`（8）均 PASS。`pnpm run lint` 4 errors 在 `tests/captcha-layout.browser.cjs`（未改动文件，PRE-EXISTING）。Review 结论：spec 合规、正确性、一致性均无 critical。

**Journey log** —
1. 本地附件 `uestc_ai-main` 无 `.git`，改为克隆 GitHub 仓库并在 `.worktrees/fix-github-issues-26-31` 上工作。
2. #29 原设计为「比赛进行中限制代码/指标可见性」，实现中途用户要求暂缓，已撤销全部 #29 改动并在 spec 中标记 DEFERRED。
3. 现有测试大量使用 `alias@std.uestc.edu.cn` 类邮箱，#28 新规则后需映射为 8–12 位学号邮箱才能通过。
4. `.track-entry` 类已从标记中移除（commit 4871c2d），真实节点是 `Link`→`<a>`；CSS 需同时覆盖 `.track-directory > a` 才能修好 banner 挤压。
5. 前端错误文案匹配依赖 `formatApiError` 的中文翻译（不是 API 英文 error key）。

## [S1] Problem

GitHub 仓库 streetartist/uestc_ai 上有 6 个 open issue（#26–#31，均由 rumunius 于 2026-10-15 提出），涵盖前端样式、注册权限、文案引导与验证码体验。本地代码均未修复，需一并解决。

## [S2] Design

### Issue #28 — 单人注册多账户风险（backend/auth + frontend/login）
- 现状：`is_campus_email` 只校验域名 `@std.uestc.edu.cn`，邮箱别名可绕过邀请码注册。
- 目标：仅 `{学号}@std.uestc.edu.cn`（学号为数字格式，长度 8–12）可免邀请码注册；不满足学号格式的 `*@std.uestc.edu.cn` 视同校外邮箱，需要邀请码。
- 合同：`backend/platform_api/routes/auth.py` 新增 `is_student_id_email(email)`；注册与验证码请求路径均使用该判定。前端 `app/login/page.tsx` 的 `externalEmail` 判定同步更新。

### Issue #29 — 作品页可查看他人作品/代码/指标（DEFERRED by user 2026-10-16）
- 用户明确要求：Issue #29 **先别修复**。本轮不做任何作品可见性/附件权限/指标展示改动。
- 原设计（供后续参考）：比赛进行中代码类附件与评测指标仅本人队伍/评委/管理员可见；赛后公开。
- 合同：本轮无实现任务；T2/T5 移出本轮范围。

### Issue #31 — 数字验证码消失 +「验证码」文案指代不明（frontend/EmailCodeField）
- 现状：发送邮件验证码成功/失败后 `setChallenge(null)` 清空数字验证码；提示文案「验证码」未区分数字/邮箱验证码。
- 目标：发送邮件验证码后保留数字验证码图片与已输入数字（除非后端明确失效）；所有提示文案明确写「数字验证码」或「邮箱验证码」。
- 合同：`app/components/EmailCodeField.tsx` 修改 `send()` 成功路径不清空 `challenge`/`digits`；错误文案与成功提示区分两类验证码。

### Issue #27 — 「题目资源面板」指代不明 + memory 字段未告知（docs/content）
- 现状：赛题文档写「题目资源面板 / 资源面板」，UI 导航叫「API 平台」；starter `config.json` 的 `memory` 字段无说明。
- 目标：文档统一改为「API 平台」并在首次出现处加括号说明；在赛题 README/规则中补充 `memory` 字段取值（`same-test-only` 等）与作用说明。
- 合同：更新 `backend/competitions/wujie-cup-2026/*.md` 与 `backend/build_wujie_starters.py` 的注释/说明文案。

### Issue #30 — 赛道 banner 被挤压（frontend/css）
- 现状：`track-directory` 三列网格中 `club-track-visual` 固定 `height:190px`，图片被 `object-fit:cover` 裁切/挤压。
- 目标：赛道 banner 使用 `aspect-ratio` 约束 + `object-fit:contain`（或等比 cover），保证图片不被压扁。
- 合同：`app/visual-polish.css` 调整 `.track-directory .club-track-visual` 与 `.track-card > .club-track-visual` 的高度/比例规则。

### Issue #26 — 首页 blog 卡片排版（frontend/css）
- 现状：`update-featured-info` 为 `background:#fff`，文字贴边、与整体风格不符。
- 目标：卡片信息区增加水平 padding，背景改为与站点一致的 `var(--surface)` 或 `var(--paper)`，保留圆角与边框。
- 合同：`app/visual-polish.css` / `app/reference-video-sections.css` 调整 `.update-featured-info` 与相关卡片内边距。

## [S3] Out of Scope

- 不改变赛事业务流程（组队、报名、评审、成绩导入）。
- 不引入新的身份提供商或实名认证。
- 不重构 API 平台整体信息架构，仅统一文案与补充字段说明。
- 不修复 issue 中未提及的其他样式问题。

## Tasks

- [x] T1: 后端注册学号校验（#28）— acceptance: `*@std.uestc.edu.cn` 非学号格式注册需邀请码，学号格式免邀请码；有回归测试 (covers: S2#28)
- [ ] T2: ~~后端作品/附件/指标可见性（#29）~~ DEFERRED — 用户要求暂缓 (covers: S2#29)
- [x] T3: 前端验证码体验与文案（#31）— acceptance: 发送邮件验证码后数字验证码不清空；文案区分数字/邮箱验证码 (covers: S2#31)
- [x] T4: 前端注册邀请码判定同步（#28）— acceptance: 前端 `externalEmail` 与后端学号规则一致 (covers: S2#28; depends: T1)
- [ ] T5: ~~前端作品页权限展示（#29）~~ DEFERRED — 用户要求暂缓 (covers: S2#29)
- [x] T6: 赛题文档与 starter 说明（#27）— acceptance: 文档统一「API 平台」并说明 `memory` 字段 (covers: S2#27)
- [x] T7: 赛道 banner 样式修复（#30）— acceptance: banner 等比显示不被压扁 (covers: S2#30)
- [x] T8: 首页 blog 卡片样式修复（#26）— acceptance: 卡片有内边距、背景与站点一致、保留圆角 (covers: S2#26)
- [x] T9: 全量验证（lint/typecheck/test）— acceptance: 构建与测试通过或仅剩 PRE-EXISTING 失败 (covers: S2)
