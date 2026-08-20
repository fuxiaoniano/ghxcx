# 微信公众号阅读者挂号服务系统

这是一个从公众号文章、菜单、二维码或推广页进入小程序完成挂号咨询的 monorepo 项目。系统包含原生微信小程序、NestJS 后端、Vue 管理后台、MySQL、Redis、Prisma、Docker 部署配置。

系统只用于挂号咨询和线索跟进，不做医疗诊断承诺。品牌、活动文案、价格、备案号、机构名称、隐私协议、模板消息 ID 等均通过后台配置或 `.env` 配置，不写死在页面里。

## 技术栈

- 小程序：原生微信小程序 + TypeScript
- 后端：NestJS + TypeScript + Prisma + MySQL 8 + Redis 7
- 后台：Vue 3 + Vite + TypeScript + Element Plus + Pinia
- 安全：手机号 AES-256-GCM 加密、HMAC hash 搜索、JWT、权限控制、审计日志、微信签名校验、Redis 限流和防重复提交

## 目录结构

```text
root/
  README.md
  DEPLOYMENT.md
  CHECKLIST.md
  docker-compose.yml
  .env.example
  miniprogram/
    project.config.json
    miniprogram/
      app.json
      api/
      pages/landing/
      pages/success/
      pages/appointments/
  server/
    Dockerfile
    prisma/schema.prisma
    prisma/seed.ts
    src/main.ts
    src/modules/auth/
    src/modules/wechat-mini/
    src/modules/wechat-official-account/
    src/modules/appointments/
    src/modules/notifications/
    src/modules/admin/
    src/modules/users/
    src/modules/configs/
    src/modules/crypto/
    src/modules/audit-logs/
  admin/
    src/api/
    src/router/
    src/stores/
    src/views/
```

## 本地启动

1. 复制环境变量：

```bash
copy .env.example .env
```

2. 修改 `.env`。本地先跑通可以保留占位微信配置，系统会在本地测试场景使用 mock；上线前必须填写真实 AppID、AppSecret、Token、模板 ID。

3. 启动 MySQL 和 Redis：

```bash
docker compose up -d mysql redis
```

4. 安装后端依赖并生成 Prisma Client：

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

5. 打开 Swagger 文档：

```text
http://localhost:3000/docs
```

6. 启动管理后台：

```bash
cd admin
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:5173
```

默认管理员账号密码来自 `.env`：

```text
ADMIN_INIT_USERNAME
ADMIN_INIT_PASSWORD
```

7. 导入小程序：

- 打开微信开发者工具
- 导入目录：`miniprogram/`
- 修改 `miniprogram/miniprogram/utils/config.ts` 的 `API_BASE_URL`
- 本地调试时可勾选“不校验合法域名”
- 真机和上线必须在小程序后台配置 request 合法域名

## 数据库迁移和 seed

```bash
cd server
npx prisma migrate dev --name init
npm run seed
```

生产环境使用：

```bash
npx prisma migrate deploy
npm run seed
```

## 核心接口

小程序接口：

- `POST /api/wechat/mini/login`
- `POST /api/wechat/mini/phone`
- `POST /api/wechat/mini/bind-official-account`
- `POST /api/appointments`
- `GET /api/appointments/my`
- `GET /api/appointments/my/:id`
- `GET /api/config/landing-page`

公众号接口：

- `GET /wechat/oa/callback`
- `POST /wechat/oa/callback`
- `GET /wechat/oa/oauth`
- `GET /wechat/oa/oauth/callback`

后台接口见 Swagger：`/docs`。

## 落地页配置生效方式

后台地址：`https://fxnadmin.cqzbskq.com`，进入“系统配置” -> “落地页配置”。

- 表单上方图片：点击“上传图片”，上传成功后会自动把图片地址加入“图片地址”文本框；也可以手动每行填写一个 HTTPS 图片地址。图片会在表单上方展示，并按手机屏幕宽度自适应。
- 对外展示开关：“对外展示开关”里可以控制顶部品牌、活动区域、补贴文案、价格卡片、包含项目、表单上方图片、隐私协议文本、提交后提示、底部区域、机构名称、备案号、底部说明、客服电话、我的挂号按钮是否展示。
- 表单字段：姓名、手机号授权、年龄、缺牙情况、门店、备注、隐私勾选、提交按钮会保留，避免影响用户提交挂号。
- H5 落地页生效：点击“保存落地页配置”后，刷新 `https://zbsfxn.cqzbskq.com` 立即生效。
- 小程序生效：普通文案、价格、开关、图片地址保存后，用户重新进入小程序页面会重新拉取配置；本次新增的图片/开关展示能力需要上传并发布新版小程序后，线上小程序才会识别。
- 小程序图片域名：如果图片使用本系统上传地址，需要在小程序后台把 `https://zbsfxn.cqzbskq.com` 加到 downloadFile 合法域名；request 合法域名也要包含该域名。

## 多入口挂号链接

后台地址：`https://fxnadmin.cqzbskq.com`，进入“公众号菜单”。

- 在“入口链接生成器”里填写来源标识，例如 `menu_main`、`article_01`、`qr_01`、`service_account_a`。
- 挂号链接格式：`https://zbsfxn.cqzbskq.com/wechat/oa/oauth?state=landing&source=来源标识`
- 我的挂号链接格式：`https://zbsfxn.cqzbskq.com/wechat/oa/oauth?state=my&source=来源标识`
- H5 落地页链接格式：`https://zbsfxn.cqzbskq.com/?source=来源标识`
- 公众号自定义菜单建议使用“挂号链接”和“我的挂号链接”，这样可以先完成公众号 openid 绑定，再打开小程序。
- 公众号文章“阅读原文”、二维码、推广页可以使用“挂号链接”；如果当前公众号无法配置网页授权域名，则先使用“H5 落地页链接”，用户点击页面里的“免费挂号”时会进入主服务号 OAuth。
- `source` 会写入挂号记录的“来源”字段，后台挂号管理和导出 CSV 都能看到。
- 如果是多个服务号分别直接发起 OAuth，每个服务号都要在自己的公众号后台配置网页授权域名 `zbsfxn.cqzbskq.com`，并且系统后端也要扩展对应 AppID/AppSecret；当前系统默认以主服务号 `OFFICIAL_ACCOUNT_APP_ID` 发起 OAuth。

## 微信后台手动配置

小程序后台需要配置：

- request 合法域名：后端 HTTPS 域名，例如 `https://api.example.com`
- 用户隐私保护指引：说明手机号用于挂号咨询联系
- 手机号快速验证能力：用于 `open-type="getPhoneNumber"`
- 订阅消息模板：挂号结果通知
- 小程序 AppID 和 AppSecret：填入 `.env`

公众号后台需要配置：

- 服务器地址 URL：`https://api.example.com/wechat/oa/callback`
- Token：与 `.env` 的 `OFFICIAL_ACCOUNT_TOKEN` 一致
- EncodingAESKey：填入 `.env`
- 消息加解密方式：建议先用明文调通，生产可按实际要求切换
- 网页授权域名：后端域名，不要带 `https://`
- 模板消息：挂号成功通知模板
- 公众号菜单跳转 OAuth 地址：`https://api.example.com/wechat/oa/oauth?state=menu`
- 公众号 AppID 和 AppSecret：填入 `.env`

微信开放平台：

- 如果要使用 UnionID 自动绑定，需要把公众号和小程序绑定到同一个微信开放平台账号。

## 常见问题

- 后台登录失败：确认 `npm run seed` 已执行，并检查 `.env` 的 `ADMIN_INIT_USERNAME`、`ADMIN_INIT_PASSWORD`。
- 小程序请求失败：检查 `API_BASE_URL`、后端是否启动、小程序合法域名是否配置。
- 公众号回调失败：检查 Token、服务器 URL、HTTPS 证书、服务器防火墙。
- 模板消息失败：看后台“通知记录”的错误码和错误信息，确认 openid、模板 ID、模板字段是否匹配。
- 手机号搜索搜不到：手机号不会明文落库，完整手机号搜索会转成 hash 精确匹配。
