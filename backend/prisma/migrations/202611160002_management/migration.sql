ALTER TABLE "Worker" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DeviceRegistration" ALTER COLUMN "workerId" DROP NOT NULL;
ALTER TABLE "DeviceRegistration" ADD COLUMN "model" TEXT NOT NULL DEFAULT 'Unspecified', ADD COLUMN "serialNumber" TEXT, ADD COLUMN "firmwareVersion" TEXT NOT NULL DEFAULT 'Unknown';
CREATE UNIQUE INDEX "DeviceRegistration_serialNumber_key" ON "DeviceRegistration"("serialNumber");
CREATE UNIQUE INDEX "DeviceRegistration_active_worker" ON "DeviceRegistration"("workerId") WHERE "workerId" IS NOT NULL AND "connectionStatus" <> 'revoked';
CREATE TABLE "DeviceAssignment" ("id" TEXT PRIMARY KEY, "deviceId" TEXT NOT NULL, "workerId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3));
CREATE INDEX "DeviceAssignment_deviceId_assignedAt_idx" ON "DeviceAssignment"("deviceId", "assignedAt");
INSERT INTO "DeviceAssignment" ("id", "deviceId", "workerId", "actorId", "assignedAt") SELECT 'legacy:' || "id", "id", "workerId", 'migration', "createdAt" FROM "DeviceRegistration" WHERE "workerId" IS NOT NULL AND "connectionStatus" <> 'revoked';
