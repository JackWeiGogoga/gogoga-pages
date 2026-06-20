PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "siteKey" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Project_siteKey_key" ON "Project"("siteKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Project_userId_slug_key" ON "Project"("userId", "slug");

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_key" ON "user"("email");

CREATE TABLE IF NOT EXISTS "ApiToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "lastUsedAt" DATETIME,
  "expiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "ApiToken_userId_idx" ON "ApiToken"("userId");

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_token_key" ON "session"("token");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "accessTokenExpiresAt" DATETIME,
  "refreshTokenExpiresAt" DATETIME,
  "scope" TEXT,
  "idToken" TEXT,
  "password" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME
);

CREATE TABLE IF NOT EXISTS "Deployment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "fileCount" INTEGER NOT NULL DEFAULT 0,
  "totalBytes" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" DATETIME,
  CONSTRAINT "Deployment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Deployment_projectId_createdAt_idx"
  ON "Deployment"("projectId", "createdAt");
