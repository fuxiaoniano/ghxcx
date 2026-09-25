# 代码检查报告

## 已完成内容

- 已生成 monorepo：`server/`、`admin/`、`miniprogram/`、根文档和 Docker 配置。
- 已完成 Prisma schema：`users`、`wechat_identities`、`appointments`、`notification_logs`、`admin_users`、`audit_logs`、`system_configs`、`clinics`。
- 已完成 NestJS 后端核心模块：登录、微信小程序、微信公众号、挂号、通知、后台、用户、配置、手机号加密、审计日志。
- 已完成微信公众号两种绑定能力：
  - 公众号 OAuth 中转生成 `bindToken`，小程序登录后绑定 `oaOpenId`。
  - 同开放平台下可通过 `unionId` 自动关联。
- 已完成公众号回调：
  - GET 验证 `signature`。
  - POST 支持明文消息。
  - POST 支持加密消息的 `msg_signature` 校验和 AES 解密。
- 已完成通知逻辑：
  - 优先公众号模板消息。
  - 无 `oaOpenId` 或发送失败时尝试小程序订阅消息。
  - 用户未授权订阅消息时记录 `SKIPPED`。
  - 所有通知写入 `notification_logs`。
- 已完成安全要求：
  - 手机号 AES-256-GCM 加密。
  - 手机号 HMAC hash 搜索和去重。
  - 后台默认脱敏展示。
  - 完整手机号独立接口查看。
  - `SUPER_ADMIN` 或 `VIEW_FULL_PHONE` 权限才能查看完整手机号。
  - 查看完整手机号、导出完整手机号、修改状态、备注、分配、重发通知、修改配置均写审计日志。
  - Redis 限流和 30 秒重复提交控制。
  - 管理员 JWT 和小程序 JWT 均会检查数据库账号状态。
- 已完成小程序页面：
  - 落地页、成功页、我的挂号。
  - 手机号必须通过 `open-type="getPhoneNumber"` 授权。
  - 提交前请求订阅消息。
  - 页面品牌、文案、价格、备案号、隐私协议从接口读取。
- 已完成 Vue 管理后台：
  - 登录页、仪表盘、用户管理、挂号管理、通知记录、系统配置、审计日志。
  - 完整手机号只存在当前详情抽屉状态，不写入 localStorage。
- 已完成文档：
  - `README.md`
  - `DEPLOYMENT.md`
  - `CHECKLIST.md`
  - `.env.example`
  - `docker-compose.yml`
  - `server/Dockerfile`

## 已执行检查

- 后端 TypeScript 类型检查：通过。
- 后端测试：通过，5 个测试文件，10 个测试用例。
- Prisma schema 检查：通过。
- 后端 build：通过。
- 管理后台 TypeScript 类型检查和 build：通过。
- 小程序 TypeScript 类型检查：通过。
- 接口路径一致性静态检查：小程序、后台 API 路径与后端 Controller 路径匹配。
- 前后端字段一致性静态检查：挂号字段、手机号脱敏字段、状态字段已对齐。
- 环境变量检查：代码引用的关键变量均在 `.env.example` 中列出。
- 手机号明文落库检查：数据库 schema 只有 `phoneEncrypted`、`phoneHash`、`phoneMasked`；完整手机号只在授权 service 内短暂存在。
- 完整手机号权限检查：`reveal-phone` 和完整手机号导出均有权限判断。
- 审计日志检查：查看完整手机号和导出完整手机号均写入 `audit_logs`。

## 缺失或风险点

- 当前没有接入真实微信环境验证，因为需要真实小程序、公众号、模板 ID、合法域名和 HTTPS。
- 管理后台打包体积有 Vite 警告，主要来自 Element Plus，可后续做按需加载和路由懒加载。
- 公众号 OAuth 打开小程序使用微信 URL Scheme API；真实环境需要小程序具备相应能力并在微信后台配置正确。
- Docker Compose 中 MySQL 密码需要你把 `docker-compose.yml` 和 `.env` 改成一致。
- 医疗合规文案已避免诊断承诺，但正式上线前仍建议让机构法务或合规人员审核。

## 需要手动配置的内容

- `.env` 中所有真实密钥、JWT secret、手机号加密 key、hash salt。
- 小程序 AppID、AppSecret、手机号快速验证能力、订阅消息模板 ID。
- 公众号 AppID、AppSecret、Token、EncodingAESKey、模板消息 ID。
- 后台系统配置中的品牌名称、活动标题、原价、活动价、机构名称、备案号、隐私协议、客服电话、底部说明。
- 小程序 `miniprogram/miniprogram/utils/config.ts` 的 `API_BASE_URL`。
- 服务器 HTTPS 域名、Nginx、微信合法域名。

## 本地启动步骤

1. 安装 Node.js 22、Docker Desktop。
2. 复制 `.env.example` 为 `.env`。
3. 启动 MySQL 和 Redis：

```bash
docker compose up -d mysql redis
```

4. 初始化后端：

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

5. 启动后台：

```bash
cd admin
npm install
npm run dev
```

6. 微信开发者工具导入 `miniprogram/`，修改 `API_BASE_URL`。

## 服务器部署步骤

详细步骤见 `DEPLOYMENT.md`。核心顺序：

1. 准备 Ubuntu 服务器和域名。
2. 安装 Docker、Node.js、Nginx。
3. 上传代码并配置 `.env`。
4. 启动 MySQL、Redis。
5. 执行 Prisma migration 和 seed。
6. 构建并启动后端 Docker 服务。
7. 构建管理后台并用 Nginx 托管。
8. Nginx 反向代理后端。
9. 配置 HTTPS。
10. 配置小程序和公众号后台。

## 微信后台配置步骤

小程序后台：

- request 合法域名。
- 用户隐私保护指引。
- 手机号快速验证能力。
- 订阅消息模板。
- 小程序 AppID 和 AppSecret。

公众号后台：

- 服务器地址：`https://你的后端域名/wechat/oa/callback`
- Token。
- EncodingAESKey。
- 消息加解密方式。
- 网页授权域名。
- 模板消息。
- 菜单跳转：`https://你的后端域名/wechat/oa/oauth?state=menu`
- 公众号 AppID 和 AppSecret。

微信开放平台：

- 如需 UnionID 自动绑定，把公众号和小程序绑定到同一个开放平台账号。

## 后续优化建议

- 管理后台改为路由懒加载和 Element Plus 按需引入，降低首包体积。
- 增加端到端测试，覆盖真实小程序登录、手机号授权、公众号 OAuth。
- 增加管理员管理页面，用后台直接创建 STAFF/MANAGER。
- 增加门店管理页面，目前门店可通过 seed 或数据库维护。
- 增加短信通知兜底，防止微信消息不可达。
- 增加通知失败自动重试队列，例如 BullMQ。
