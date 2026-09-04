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
- `GET /api/config/landing-page/:pageKey`
- `POST /api/public/landing-pages/:pageKey/appointments`

公众号接口：

- `GET /wechat/oa/callback`
- `POST /wechat/oa/callback`
- `GET /wechat/oa/oauth`
- `GET /wechat/oa/oauth/callback`

后台接口见 Swagger：`/docs`。

## 落地页配置生效方式

后台地址：`https://fxnadmin.cqzbskq.com`，进入“系统配置” -> “挂号落地页”。

- 页面首先以列表展示；点击对应行的“编辑”进入独立配置，“新建页面”和“复制”可快速制作不同渠道或不同活动版本。
- 页面名称可以修改，PageKey 和三个永久链接不会变化。停用页面后，其 H5 和小程序专属入口会返回“页面不存在或已停用”。
- 列表支持删除页面。删除会清除该页全部配置和永久链接，历史挂号完整保留；删除默认页时系统会自动选择另一个页面作为默认页，最后一个页面不可删除。
- “顶部品牌”和“活动与价格”支持可视化编辑及 HTML 源码编辑。后端保存时会清理脚本、事件属性和危险链接。
- 表单上方图片、表单文案、年龄/缺牙选项、底部说明、客服电话、模板 ID 和展示开关均按页面独立保存。
- H5 永久链接适用于公众号原文、短信和网页广告。H5 手机号默认由用户手动填写，并在浏览器和后端同时校验为 11 位手机号。
- 小程序 PagePath 适用于小程序广告或菜单；小程序内仍使用微信手机号授权，不会把完整手机号交给前端提交。
- 公众号绑定链接会先获取公众号 openid，再携带当前 PageKey 打开相同的小程序挂号页。
- 点击“设为默认页”后，旧地址 `https://zbsfxn.cqzbskq.com` 和旧 PagePath `pages/landing/landing` 会继续可用，并显示新的默认页。
- 点击“保存当前页面”后 H5 刷新立即生效，小程序用户重新进入相应 PagePath 后会读取最新配置。
- 系统上传图片使用 `https://zbsfxn.cqzbskq.com`，该域名必须同时加入小程序 request 和 downloadFile 合法域名。

## 首页广告跳转设置

后台进入“首页管理” -> “首页广告”，新增或编辑广告时把“跳转类型”设为“小程序页面”，再填写页面路径。保存后，小程序重新进入首页即可读取最新配置。

- 首页：`/pages/home/home`
- 医生介绍：`/pages/doctors/doctors`
- 预约挂号：`/pages/booking/booking`
- 推荐套餐：`/pages/packages/packages`
- 普通详情页可以携带参数，例如：`/pages/package-detail/package-detail?id=套餐ID`

## 多入口挂号链接

后台地址：`https://fxnadmin.cqzbskq.com`，进入“公众号菜单”。

- 在“入口链接生成器”里填写来源标识，例如 `menu_main`、`article_01`、`qr_01`、`service_account_a`。
- 默认挂号链接格式：`https://zbsfxn.cqzbskq.com/wechat/oa/oauth?state=landing&source=来源标识`
- 我的挂号链接格式：`https://zbsfxn.cqzbskq.com/wechat/oa/oauth?state=my&source=来源标识`
- 每个独立页面的 H5、PagePath 和公众号绑定链接直接在“系统配置” -> “挂号落地页”复制，不需要手工拼接。
- 公众号自定义菜单建议使用页面对应的“公众号绑定链接”，这样会绑定公众号 openid 并打开同一个独立小程序页面。
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
