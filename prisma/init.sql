PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Project_slug_key" ON "Project"("slug");

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
