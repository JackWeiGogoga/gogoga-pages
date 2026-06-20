# Gogoga Pages

一个极简静态网站部署平台 MVP。

当前实现：

- Next.js App Router 管理后台
- SQLite + Prisma
- shadcn 风格基础组件
- 上传 zip 静态站点、单个 html 文件，或多个 html 文件
- 安全解压、校验 `index.html`
- 发布到 `{slug}.pages.gogoga.top`
- 用 `sites/{slug}/current` 软链接支持原子发布和回滚

## 本地启动

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

如果本机 Prisma schema-engine 无法执行，可以用 SQL 兜底初始化：

```bash
npm run db:init
```

访问：

```text
http://localhost:3000/dashboard
```

本地默认数据目录：

```text
.local-data/
  uploads/
  deployments/
  sites/
```

## 生产环境变量

```env
DATABASE_URL="file:/opt/gogoga-pages/data/app.db"
GOGOGA_DATA_DIR="/data/gogoga"
GOGOGA_SITE_DOMAIN="pages.gogoga.top"
GOGOGA_MAX_UPLOAD_MB="100"
BETTER_AUTH_SECRET="replace-with-a-random-32-byte-secret"
BETTER_AUTH_URL="https://app.pages.gogoga.top"
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

启用第三方登录时，在 OAuth 应用中配置回调地址：

```text
https://app.pages.gogoga.top/api/auth/callback/github
https://app.pages.gogoga.top/api/auth/callback/google
```

生产部署目录：

```text
/data/gogoga/
  uploads/
  deployments/
  sites/
    demo/
      current -> /data/gogoga/deployments/{deploymentId}
```

## DNS

在阿里云 DNS 配置：

```text
A     pages.gogoga.top        -> 你的服务器公网 IP
A     *.pages.gogoga.top      -> 你的服务器公网 IP
```

建议证书覆盖：

```text
pages.gogoga.top
*.pages.gogoga.top
```

## Nginx

参考：

```text
deploy/nginx/gogoga-pages.conf
```

分流规则：

```text
app.pages.gogoga.top       -> Next.js :3000
pages.gogoga.top           -> 跳转到 app.pages.gogoga.top
{slug}.pages.gogoga.top    -> /data/gogoga/sites/{slug}/current
```

## Caddy + Docker 生产部署

当前推荐在服务器上使用 Caddy，因为服务器已有 Caddy 占用 80/443：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

初始化 SQLite：

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:init:prod
docker compose -f docker-compose.prod.yml exec app npx prisma db push
```

Caddy 配置参考：

```text
deploy/caddy/pages.Caddyfile
```

## 安全边界

管理后台已接入 Better Auth 邮箱密码登录。正式暴露到公网前，务必设置强随机 `BETTER_AUTH_SECRET`。

上传部署已实现的校验：

- 只接受 zip、html、htm
- zip 一次只能上传一个文件
- 多个 html 会按文件名生成子路径，例如 `about.html` -> `/about/`
- 限制上传大小
- 限制解压后总大小
- 限制文件数量
- 禁止绝对路径和 `..` 路径穿越
- 要求根目录存在 `index.html`
