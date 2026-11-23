# StudyBuddy

个人学习知识工作台：导入每天的 Markdown 和 LeetCode 截图，由 AI 按语义建立“领域 → 主题 → 子主题”分组，并按“基础 → 进阶”稳定排序，持续合并为一张可折叠思维导图，并提供关键词搜索、客观题和问答题。

桌面顶部、左侧目录和手机端都提供浏览器式的内联搜索：直接输入关键词，结果会在输入框下方动态展开。

## 本地启动

```powershell
pnpm install
pnpm dev
```

打开 <http://localhost:3000>。数据库为空时，登录页会进入首次设置，创建唯一账户。

本地默认使用内置 PGlite，数据目录和上传文件位于 `D:\StudyBuddyData`，不占用 Docker 的 C 盘镜像空间。Docker 镜像数据也已迁到 `D:\DockerData\DockerDesktopWSL`。

## 接入模型

1. 登录后打开右上角账户菜单 → 模型设置。
2. 默认显示名为 `DeepSeek V4.1 Flash`。
3. 填写服务商提供的 Base URL、API Model ID 和 API Key。
4. 保存后点击测试连接。只有通过的文本、JSON、图片或向量能力才会绑定到对应任务。
5. 如果主模型不支持图片，可新增一个支持视觉的模型并只绑定“截图提取”。

API Key 使用 AES-256-GCM 加密保存，应用和页面只显示尾号。

## 导入

- Markdown：`.md`、`.markdown`，最大 5 MiB。
- 图片：PNG、JPEG、WebP，最大 20 MiB。
- 单个任务最多 20 个文件，总共可分批上传。
- Worker 会先提取内容，再规范化知识点、合并已有节点、建立关联、写入搜索索引和生成题目。
- 刷新或离开页面不会中断后台任务。

## 验证

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm smoke
```

Playwright 使用本机 Edge，不额外下载 Chromium。E2E 前会创建本地测试账户，生产环境会拒绝该步骤。

## 运维

- [部署说明](docs/operations/deployment.md)
- [备份与恢复](docs/operations/backup-restore.md)
- [模型接入](docs/operations/model-setup.md)
