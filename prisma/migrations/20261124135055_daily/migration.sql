-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT NOT NULL,
    "workstreamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'update_request',
    "recipient" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "forDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'generated',
    "projectId" TEXT NOT NULL,
    "memberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Communication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Communication_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'change',
    "summary" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StatusReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'generated',
    "kind" TEXT NOT NULL DEFAULT 'status',
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StatusReport" ("body", "createdAt", "id", "periodEnd", "periodStart", "projectId", "source", "title") SELECT "body", "createdAt", "id", "periodEnd", "periodStart", "projectId", "source", "title" FROM "StatusReport";
DROP TABLE "StatusReport";
ALTER TABLE "new_StatusReport" RENAME TO "StatusReport";
CREATE INDEX "StatusReport_projectId_createdAt_idx" ON "StatusReport"("projectId", "createdAt");
CREATE TABLE "new_Workstream" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "percentComplete" INTEGER NOT NULL DEFAULT 0,
    "plannedStart" DATETIME,
    "plannedFinish" DATETIME,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "Workstream_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Workstream" ("description", "id", "name", "order", "owner", "projectId") SELECT "description", "id", "name", "order", "owner", "projectId" FROM "Workstream";
DROP TABLE "Workstream";
ALTER TABLE "new_Workstream" RENAME TO "Workstream";
CREATE INDEX "Workstream_projectId_idx" ON "Workstream"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TeamMember_projectId_idx" ON "TeamMember"("projectId");

-- CreateIndex
CREATE INDEX "Communication_projectId_forDate_idx" ON "Communication"("projectId", "forDate");

-- CreateIndex
CREATE INDEX "Activity_projectId_at_idx" ON "Activity"("projectId", "at");
