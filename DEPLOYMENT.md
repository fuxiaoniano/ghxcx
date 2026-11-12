# 服务器部署步骤

> 只向运维资产清单标记为“当前生产”的服务器发布。已退役服务器停止版本更新和日常维护；除非明确执行灾难回滚，不得向其发布代码、静态文件、迁移或配置。生产地址和登录方式不得写入仓库。

以下步骤面向代码小白，按顺序执行即可。示例使用 Ubuntu 22.04，域名示例为：

- 后端：`https://api.example.com`
- 后台：`https://admin.example.com`

请替换成你自己的域名。

## 1. 准备服务器

1. 购买 2 核 4G 或以上云服务器。
2. 系统选择 Ubuntu 22.04 LTS。
3. 安全组放行端口：`22`、`80`、`443`。
4. 准备两个域名并解析到服务器 IP：`api.example.com`、`admin.example.com`。

## 2. 安装 Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

## 3. 安装 Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 4. 上传代码并配置环境变量

```bash
cd /opt
sudo mkdir wechat-appointment
sudo chown $USER:$USER wechat-appointment
cd wechat-appointment
```

把本项目上传到 `/opt/wechat-appointment` 后执行：

```bash
cp .env.example .env
nano .env
```

必须修改：

- `SERVER_BASE_URL=https://api.example.com`
- `FRONTEND_BASE_URL=https://admin.example.com`
- `MYSQL_URL=mysql://wechat_user:你的数据库密码@mysql:3306/wechat_appointment`
- `JWT_SECRET`、`ADMIN_JWT_SECRET`、`PHONE_ENCRYPTION_KEY`、`PHONE_HASH_SALT` 改成长随机字符串
- 微信小程序、公众号 AppID、AppSecret、Token、模板 ID
- `ADMIN_INIT_PASSWORD` 改成强密码
- `CORS_ORIGINS=https://admin.example.com`

## 5. 启动 MySQL 和 Redis

先修改 `docker-compose.yml` 里的 MySQL 密码，使它和 `.env` 的 `MYSQL_URL` 一致。

```bash
docker compose up -d mysql redis
docker compose ps
```

## 6. 执行 Prisma migration 和 seed

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
```

## 7. 构建并启动后端

```bash
cd /opt/wechat-appointment
docker compose up -d --build server
docker compose logs -f server
```

看到 `Nest application successfully started` 或端口监听成功即表示后端启动。

## 8. 构建管理后台

```bash
cd /opt/wechat-appointment/admin
npm install
VITE_API_BASE_URL=https://api.example.com npm run build
```

构建产物在 `admin/dist`。

## 9. 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 10. Nginx 部署后台

```bash
sudo mkdir -p /var/www/wechat-admin
sudo cp -r /opt/wechat-appointment/admin/dist/* /var/www/wechat-admin/
```

创建配置：

```bash
sudo nano /etc/nginx/sites-available/wechat-admin
```

写入：

```nginx
server {
  listen 80;
  server_name admin.example.com;
  root /var/www/wechat-admin;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/wechat-admin /etc/nginx/sites-enabled/wechat-admin
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Nginx 反向代理后端

```bash
sudo nano /etc/nginx/sites-available/wechat-api
```

写入：

```nginx
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/wechat-api /etc/nginx/sites-enabled/wechat-api
sudo nginx -t
sudo systemctl reload nginx
```

## 12. 配置 HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com -d admin.example.com
```

检查自动续期：

```bash
sudo certbot renew --dry-run
```

## 13. 配置小程序

微信小程序后台：

1. 开发管理 -> 开发设置 -> request 合法域名：填写 `https://api.example.com`
2. 服务内容声明 -> 用户隐私保护指引：声明收集手机号用于挂号咨询联系
3. 开通手机号快速验证能力
4. 配置订阅消息模板，复制模板 ID 到 `.env` 或后台系统配置
5. 把小程序 AppID、AppSecret 填入 `.env`
6. 重启后端：

```bash
docker compose restart server
```

## 14. 配置公众号

公众号后台：

1. 基本配置 -> 服务器配置：
   - URL：`https://api.example.com/wechat/oa/callback`
   - Token：填写 `.env` 的 `OFFICIAL_ACCOUNT_TOKEN`
   - EncodingAESKey：填写 `.env` 的 `OFFICIAL_ACCOUNT_ENCODING_AES_KEY`
   - 消息加解密方式：先用明文调通
2. 功能设置 -> 网页授权域名：填写 `api.example.com`
3. 模板消息：创建挂号成功通知模板，复制模板 ID 到 `.env` 或后台系统配置
4. 自定义菜单：菜单 URL 填 `https://api.example.com/wechat/oa/oauth?state=menu`
5. 把公众号 AppID、AppSecret 填入 `.env`
6. 重启后端。

## 15. 配置微信开放平台

如果希望 UnionID 自动绑定：

1. 登录微信开放平台。
2. 创建或进入同一主体账号。
3. 绑定公众号。
4. 绑定小程序。
5. 用户同时访问公众号和小程序后，后端可根据 unionId 自动关联身份。

## 16. 查看日志

```bash
docker compose logs -f server
docker compose logs -f mysql
docker compose logs -f redis
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 17. 重启服务

```bash
docker compose restart server
sudo systemctl reload nginx
```

## 18. 备份数据库

```bash
docker exec -i $(docker compose ps -q mysql) mysqldump -uwechat_user -pchange-me wechat_appointment > backup.sql
```

把 `change-me` 换成你的 MySQL 密码。

## 19. 恢复数据库

```bash
cat backup.sql | docker exec -i $(docker compose ps -q mysql) mysql -uwechat_user -pchange-me wechat_appointment
```

## 20. 排查 502

1. 看后端是否运行：`docker compose ps`
2. 看后端日志：`docker compose logs -f server`
3. 看端口是否监听：`curl http://127.0.0.1:3000/docs`
4. 检查 Nginx 配置：`sudo nginx -t`
5. 检查 `.env` 是否缺数据库或 Redis 地址。

## 21. 排查微信回调失败

1. 确认公众号服务器 URL 是 `https://api.example.com/wechat/oa/callback`
2. 确认 Token 和 `.env` 完全一致。
3. 确认 HTTPS 证书有效。
4. 确认服务器 443 端口放行。
5. 看 Nginx access/error log 和后端日志。

## 22. 排查模板消息失败

1. 登录后台 -> 通知记录。
2. 看 `channel`、`status`、`errorCode`、`errorMessage`。
3. `NO_OA_OPENID`：用户没有完成公众号 OAuth 绑定。
4. `NO_TEMPLATE_ID`：没有配置模板 ID。
5. 微信错误 `40003`：openid 不正确或不是公众号 openid。
6. 微信错误 `43101`：用户没有授权小程序订阅消息，系统会记录为 `SKIPPED`。
