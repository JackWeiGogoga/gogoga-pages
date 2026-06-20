# Deployment Operations

This document records the production deployment workflow for Gogoga Pages.

The current production stack:

```text
GitHub Actions -> Aliyun ACR -> Aliyun ECS Docker -> Caddy -> gogoga-pages app
```

Domains:

```text
pages.gogoga.top              -> redirect to app.pages.gogoga.top
app.pages.gogoga.top          -> management app
{slug}.pages.gogoga.top       -> user static sites
```

## 1. ACR Image

Current ACR registry:

```text
crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
```

Image format:

```text
crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com/gogoga/gogoga-pages:{tag}
```

Common tags:

```text
latest
{github.sha}
v0.1.0
```

## 2. GitHub Actions

GitHub secrets entry:

```text
Repository
-> Settings
-> Secrets and variables
-> Actions
-> Repository secrets
```

Required secrets:

```text
ALIYUN_REGISTRY
= crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
```

```text
ALIYUN_REGISTRY_USERNAME
= gogoga
```

```text
ALIYUN_REGISTRY_PASSWORD
= <ACR Registry login password>
```

```text
ALIYUN_REGISTRY_NAMESPACE
= gogoga
```

Workflow file location:

```text
.github/workflows/docker.yml
```

Run history:

```text
Repository
-> Actions
```

Minimal workflow:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  docker:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ secrets.ALIYUN_REGISTRY }}
          username: ${{ secrets.ALIYUN_REGISTRY_USERNAME }}
          password: ${{ secrets.ALIYUN_REGISTRY_PASSWORD }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ${{ secrets.ALIYUN_REGISTRY }}/${{ secrets.ALIYUN_REGISTRY_NAMESPACE }}/gogoga-pages:latest
            ${{ secrets.ALIYUN_REGISTRY }}/${{ secrets.ALIYUN_REGISTRY_NAMESPACE }}/gogoga-pages:${{ github.sha }}
```

## 3. Server Layout

Server:

```bash
ssh ali
```

Directories:

```text
/opt/gogoga-pages/
  docker-compose.yml
  data/

/data/gogoga/
  uploads/
  deployments/
  sites/
```

Create directories:

```bash
mkdir -p /opt/gogoga-pages/data
mkdir -p /data/gogoga
```

## 4. Docker Compose

File:

```text
/opt/gogoga-pages/docker-compose.yml
```

Content:

```yaml
services:
  app:
    image: crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com/gogoga/gogoga-pages:latest
    container_name: gogoga-pages-app
    restart: unless-stopped
    environment:
      DATABASE_URL: "file:/data/db/app.db"
      GOGOGA_DATA_DIR: "/data/gogoga"
      GOGOGA_SITE_DOMAIN: "pages.gogoga.top"
      GOGOGA_MAX_UPLOAD_MB: "100"
      BETTER_AUTH_SECRET: "${BETTER_AUTH_SECRET:?set BETTER_AUTH_SECRET}"
      BETTER_AUTH_URL: "https://app.pages.gogoga.top"
      GITHUB_CLIENT_ID: "${GITHUB_CLIENT_ID:-}"
      GITHUB_CLIENT_SECRET: "${GITHUB_CLIENT_SECRET:-}"
      GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID:-}"
      GOOGLE_CLIENT_SECRET: "${GOOGLE_CLIENT_SECRET:-}"
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - /opt/gogoga-pages/data:/data/db
      - /data/gogoga:/data/gogoga
```

Login to ACR:

```bash
docker login --username=gogoga crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
```

Start:

```bash
cd /opt/gogoga-pages
docker compose pull
docker compose up -d
```

Initialize SQLite on first deploy:

```bash
docker compose exec app npm run db:init:prod
docker compose exec app npx prisma db push
```

OAuth redirect URLs:

```text
https://app.pages.gogoga.top/api/auth/callback/github
https://app.pages.gogoga.top/api/auth/callback/google
```

Verify:

```bash
docker ps
docker logs -f gogoga-pages-app
curl -I http://127.0.0.1:3000/dashboard
```

## 5. DNS

Required DNS records:

```text
A  pages.gogoga.top     -> ECS public IP
A  *.pages.gogoga.top   -> ECS public IP
```

Existing root wildcard certificate:

```text
*.gogoga.top
```

This covers:

```text
support.gogoga.top
ecdict.gogoga.top
sqlite.gogoga.top
```

It does not cover:

```text
app.pages.gogoga.top
demo.pages.gogoga.top
```

For the pages platform, a separate certificate is required:

```text
pages.gogoga.top
*.pages.gogoga.top
```

## 6. Certificates

The server uses `acme.sh` with Aliyun DNS.

Load Aliyun DNS credentials:

```bash
source /etc/acme/acme.env
```

List existing certs:

```bash
~/.acme.sh/acme.sh --list
```

Issue pages wildcard cert:

```bash
~/.acme.sh/acme.sh --issue --dns dns_ali \
  -d pages.gogoga.top \
  -d '*.pages.gogoga.top' \
  --keylength 2048
```

Install pages cert:

```bash
mkdir -p /etc/ssl/gogoga-pages

~/.acme.sh/acme.sh --install-cert \
  -d pages.gogoga.top \
  --key-file /etc/ssl/gogoga-pages/key.pem \
  --fullchain-file /etc/ssl/gogoga-pages/fullchain.pem \
  --reloadcmd "chown -R caddy:caddy /etc/ssl/gogoga-pages && chmod 750 /etc/ssl/gogoga-pages && chmod 640 /etc/ssl/gogoga-pages/* && systemctl reload caddy"
```

If reload hangs, fix permissions and restart Caddy:

```bash
chown -R caddy:caddy /etc/ssl/gogoga-pages
chmod 750 /etc/ssl/gogoga-pages
chmod 640 /etc/ssl/gogoga-pages/*
systemctl restart caddy
```

Verify cert:

```bash
openssl x509 -in /etc/ssl/gogoga-pages/fullchain.pem -noout -text \
  | grep -A1 "Subject Alternative Name"
```

Expected names:

```text
DNS:pages.gogoga.top
DNS:*.pages.gogoga.top
```

## 7. Caddy

Caddy config:

```text
/etc/caddy/Caddyfile
```

Pages config:

```caddyfile
pages.gogoga.top {
	tls /etc/ssl/gogoga-pages/fullchain.pem /etc/ssl/gogoga-pages/key.pem
	redir https://app.pages.gogoga.top{uri}
}

app.pages.gogoga.top {
	tls /etc/ssl/gogoga-pages/fullchain.pem /etc/ssl/gogoga-pages/key.pem
	encode gzip
	request_body {
		max_size 110MB
	}
	reverse_proxy 127.0.0.1:3000
}

*.pages.gogoga.top {
	tls /etc/ssl/gogoga-pages/fullchain.pem /etc/ssl/gogoga-pages/key.pem
	encode gzip
	reverse_proxy 127.0.0.1:3000
	header {
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}
}
```

Validate:

```bash
caddy validate --config /etc/caddy/Caddyfile
```

Reload:

```bash
systemctl reload caddy
```

If reload hangs or Caddy reports stale reload state:

```bash
systemctl restart caddy
```

Check:

```bash
systemctl status caddy --no-pager
ss -lntp | grep -E ':80 |:443 '
journalctl -u caddy --since "10 minutes ago" --no-pager
```

## 8. Basic Auth

The management app should not be public without authentication.

Add `basic_auth` to `app.pages.gogoga.top`:

```caddyfile
app.pages.gogoga.top {
	tls /etc/ssl/gogoga-pages/fullchain.pem /etc/ssl/gogoga-pages/key.pem
	encode gzip
	request_body {
		max_size 110MB
	}
	basic_auth {
		admin <hashed-password>
	}
	reverse_proxy 127.0.0.1:3000
}
```

Generate a password hash:

```bash
caddy hash-password
```

Note: old Caddy configs may use `basicauth`; new Caddy recommends `basic_auth`.

## 9. Update Deployment

After GitHub Actions pushes a new image:

```bash
ssh ali
cd /opt/gogoga-pages
docker compose pull
docker compose up -d
```

Check logs:

```bash
docker logs -f gogoga-pages-app
```

Verify app:

```bash
curl -I http://127.0.0.1:3000/dashboard
curl -I https://app.pages.gogoga.top
```

## 10. Restart

Restart app only:

```bash
cd /opt/gogoga-pages
docker compose restart app
```

Restart Caddy only:

```bash
systemctl restart caddy
```

Restart both:

```bash
cd /opt/gogoga-pages
docker compose restart app
systemctl restart caddy
```

## 11. Rollback Image

If using git sha tags, edit `/opt/gogoga-pages/docker-compose.yml`:

```yaml
image: crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com/gogoga/gogoga-pages:<old-sha>
```

Then:

```bash
cd /opt/gogoga-pages
docker compose pull
docker compose up -d
```

## 12. Troubleshooting

ACR login fails:

```bash
docker login --username=gogoga crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
```

Check:

```text
username is gogoga
password is the ACR Registry login password
registry address is complete
```

Caddy cannot read cert:

```text
permission denied: /etc/ssl/gogoga-pages/key.pem
```

Fix:

```bash
chown -R caddy:caddy /etc/ssl/gogoga-pages
chmod 750 /etc/ssl/gogoga-pages
chmod 640 /etc/ssl/gogoga-pages/*
systemctl restart caddy
```

Caddy validate says missing cert:

```text
open /etc/ssl/gogoga-pages/fullchain.pem: no such file or directory
```

Fix:

```bash
~/.acme.sh/acme.sh --install-cert \
  -d pages.gogoga.top \
  --key-file /etc/ssl/gogoga-pages/key.pem \
  --fullchain-file /etc/ssl/gogoga-pages/fullchain.pem
```

Caddy automatic cert fails:

```text
Timeout during connect (likely firewall problem)
```

Check:

```text
DNS points to the ECS public IP
Aliyun security group allows TCP 80 and 443 from 0.0.0.0/0
Caddy is listening on 80 and 443
```

For `support.gogoga.top`, prefer using the existing `*.gogoga.top` certificate instead of Caddy automatic issuance.

Container is not running:

```bash
docker ps -a
docker logs gogoga-pages-app
```

Local app health:

```bash
curl -I http://127.0.0.1:3000/dashboard
```

Public app health:

```bash
curl -I https://app.pages.gogoga.top
```

Clean unused images:

```bash
docker image prune
docker image prune -a
```
