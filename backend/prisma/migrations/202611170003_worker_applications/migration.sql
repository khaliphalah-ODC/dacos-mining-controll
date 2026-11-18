CREATE TYPE "WorkerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE "WorkerApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fullName" TEXT NOT NULL, "nameKey" TEXT NOT NULL,
  "phone" TEXT NOT NULL, "phoneKey" TEXT NOT NULL,
  "employeeNumber" TEXT, "employeeKey" TEXT,
  "jobTitle" TEXT NOT NULL, "workArea" TEXT NOT NULL,
  "site" TEXT NOT NULL, "siteKey" TEXT NOT NULL, "shift" TEXT NOT NULL,
  "emergencyContact" TEXT, "privacyVersion" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL, "fingerprint" TEXT NOT NULL,
  "status" "WorkerApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3), "reviewedBy" TEXT, "reviewNote" TEXT,
  "approvedWorkerId" TEXT REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkerApplication_workArea_check" CHECK ("workArea" IN ('UNDERGROUND','OUTDOOR','BOTH'))
);
CREATE INDEX "WorkerApplication_status_createdAt_id_idx" ON "WorkerApplication"("status","createdAt","id");
CREATE INDEX "WorkerApplication_siteKey_employeeKey_idx" ON "WorkerApplication"("siteKey","employeeKey");
CREATE INDEX "WorkerApplication_phoneKey_idx" ON "WorkerApplication"("phoneKey");
CREATE INDEX "WorkerApplication_nameKey_idx" ON "WorkerApplication"("nameKey");
-- Exact resubmissions collapse only while pending. A rejected applicant may reapply.
CREATE UNIQUE INDEX "WorkerApplication_pending_fingerprint_key" ON "WorkerApplication"("fingerprint") WHERE "status" = 'PENDING';
CREATE TABLE "WorkerPrivateProfile" (
  "workerId" TEXT NOT NULL PRIMARY KEY REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "phone" TEXT NOT NULL, "phoneKey" TEXT NOT NULL,
  "employeeNumber" TEXT, "employeeKey" TEXT,
  "workArea" TEXT NOT NULL, "site" TEXT NOT NULL, "siteKey" TEXT NOT NULL,
  "emergencyContact" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkerPrivateProfile_workArea_check" CHECK ("workArea" IN ('UNDERGROUND','OUTDOOR','BOTH'))
);
CREATE UNIQUE INDEX "WorkerPrivateProfile_siteKey_employeeKey_key" ON "WorkerPrivateProfile"("siteKey","employeeKey");
CREATE INDEX "WorkerPrivateProfile_phoneKey_idx" ON "WorkerPrivateProfile"("phoneKey");
CREATE TABLE "RegistrationThrottle" (
  "id" TEXT NOT NULL PRIMARY KEY, "hits" INTEGER NOT NULL, "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RegistrationThrottle_resetAt_idx" ON "RegistrationThrottle"("resetAt");
