# Aliyun ACR and GitHub Actions Guide

This guide records how this project uses Aliyun Container Registry (ACR) with GitHub Actions.

## ACR Image Format

Image address format:

```text
{registry}/{namespace}/{repository}:{tag}
```

Current registry:

```text
crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
```

Example image:

```text
crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com/gogoga/gogoga-pages:latest
```

Parts:

```text
registry    = crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
namespace   = gogoga
repository  = gogoga-pages
tag         = latest / git sha / version
```

## Docker Login

Login command from ACR:

```bash
docker login --username=gogoga crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
```

Use the ACR Registry login password, not the Aliyun account login password.

## GitHub Secrets Entry

GitHub repository page:

```text
Settings
-> Secrets and variables
-> Actions
-> Repository secrets
-> New repository secret
```

Add these repository secrets:

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

Notes:

- Put passwords and tokens in `Repository secrets`.
- GitHub will not show secret values again after saving.
- To update a secret, overwrite it from the same page.

## GitHub Actions Workflow Entry

Workflow files live in:

```text
.github/workflows/
```

Example:

```text
.github/workflows/docker.yml
```

GitHub Actions run history is visible from:

```text
Repository
-> Actions
```

## Example Workflow

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

## Pull Image on Server

Login on the Aliyun server:

```bash
docker login --username=gogoga crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
```

Pull the image:

```bash
docker pull crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com/gogoga/gogoga-pages:latest
```

## Docker Compose Image Config

Use the pushed image instead of building from source on the server:

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
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - /opt/gogoga-pages/data:/data/db
      - /data/gogoga:/data/gogoga
```

Deploy or update:

```bash
docker compose pull
docker compose up -d
```

## Tag Strategy

Development:

```text
latest
```

Production:

```text
git sha
v0.1.0
v0.2.0
```

Examples:

```text
gogoga-pages:latest
gogoga-pages:8f3a2c1
gogoga-pages:v0.1.0
```

For production, prefer a fixed version or git sha instead of relying only on `latest`.

## Common Issues

Login failed:

```bash
docker login --username=gogoga crpi-cz1bq3q6oq06kdw9.cn-beijing.personal.cr.aliyuncs.com
```

Check:

```text
username is gogoga
password is the ACR Registry login password
registry address is complete
```

Push failed:

```text
denied: requested access to the resource is denied
```

Common causes:

```text
wrong namespace
repository not created
account has no permission
```

Pull is slow:

```text
Use the ACR region closest to the server.
For a Beijing server, prefer cn-beijing.
```

Clean unused Docker images:

```bash
docker image prune
docker image prune -a
```

