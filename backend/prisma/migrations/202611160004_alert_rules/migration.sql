CREATE TABLE "AlertRule" ("id" TEXT PRIMARY KEY,"metric" TEXT NOT NULL,"comparator" TEXT NOT NULL,"threshold" DOUBLE PRECISION NOT NULL,"severity" TEXT NOT NULL,"enabled" BOOLEAN NOT NULL DEFAULT false,"createdBy" TEXT NOT NULL,"reviewedBy" TEXT,"reviewNote" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE "OperationalIncident" ADD COLUMN "ruleId" TEXT;
CREATE UNIQUE INDEX "OperationalIncident_open_rule_device" ON "OperationalIncident"("ruleId","deviceId") WHERE "ruleId" IS NOT NULL AND "status" <> 'resolved';
