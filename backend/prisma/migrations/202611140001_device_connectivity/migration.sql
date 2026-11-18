CREATE TABLE "DeviceRegistration" (
 "id" TEXT PRIMARY KEY, "workerId" TEXT NOT NULL, "transport" TEXT NOT NULL, "source" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeen" TIMESTAMP(3), "sequence" INTEGER NOT NULL DEFAULT -1, "timestamp" TIMESTAMP(3),
 "connectionStatus" TEXT NOT NULL DEFAULT 'unavailable', "metrics" JSONB NOT NULL
);
CREATE TABLE "DeviceTelemetry" (
 "id" TEXT PRIMARY KEY, "deviceId" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
 "timestamp" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "packet" JSONB NOT NULL
);
CREATE UNIQUE INDEX "DeviceTelemetry_deviceId_sequence_key" ON "DeviceTelemetry"("deviceId", "sequence");
CREATE TABLE "IncidentEvent" (
 "id" TEXT PRIMARY KEY, "deviceId" TEXT NOT NULL, "workerId" TEXT NOT NULL, "timestamp" TIMESTAMP(3) NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "message" TEXT NOT NULL, "simulation" BOOLEAN NOT NULL DEFAULT true
);
