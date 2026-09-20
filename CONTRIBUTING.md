# 贡献指南

感谢你帮助改进 UESTC AI 社平台。提交改动前，请先搜索现有 issue，较大的功能或数据模型变更建议先开 issue 说明目标、范围和迁移方案。

## 开发环境

- Node.js 22.13 或更高版本
- pnpm 10.18.2
- Python 3.11 或更高版本

按照 [README](README.md#本地开发) 完成前后端安装。不要提交 `.env`、本地数据库、上传文件、构建目录或部署压缩包。

## 提交改动

1. 从 `main` 创建短生命周期分支。
2. 保持改动聚焦；数据库模型变更必须附带 Alembic 迁移。
3. 新行为应补充相应的前端或后端测试。
4. 提交前运行完整检查：

```bash
pnpm lint
pnpm test
python -m unittest discover -s tests -p "test_backend_api.py" -v
```

Pull request 请说明问题背景、实现方式、验证结果以及任何配置或迁移影响。界面改动请附截图；安全问题不要公开提交 issue，应按 [安全策略](SECURITY.md) 报告。

## 代码约定

- 遵循现有 TypeScript、React 和 Flask 结构，不在前端写死赛事、赛道或题目。
- API 错误保持结构化 JSON，并在必要时同步更新前端错误文案。
- 上传、鉴权、评分与数据迁移属于高风险区域，改动必须覆盖失败路径和权限边界。
- 文档与配置示例不得包含真实凭据、个人令牌或生产地址。

提交贡献即表示你同意按本仓库的 [MIT License](LICENSE) 授权你的贡献。
