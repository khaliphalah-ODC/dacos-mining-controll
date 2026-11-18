CREATE TYPE "LocationSource" AS ENUM ('GNSS','BLE','UWB','SIMULATED');
ALTER TABLE "DeviceRegistration" ADD COLUMN "locationSequence" INTEGER NOT NULL DEFAULT -1;
CREATE TABLE "LocationObservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workerId" TEXT NOT NULL REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "deviceId" TEXT NOT NULL REFERENCES "DeviceRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "source" "LocationSource" NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sequence" INTEGER NOT NULL, "simulation" BOOLEAN NOT NULL,
  "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
  "x" DOUBLE PRECISION, "y" DOUBLE PRECISION, "z" DOUBLE PRECISION,
  "coordinateFrame" TEXT, "zoneId" TEXT, "checkpointId" TEXT,
  "accuracyMeters" DOUBLE PRECISION, "confidence" DOUBLE PRECISION, "fingerprint" TEXT NOT NULL,
  CONSTRAINT "LocationObservation_simulation_check" CHECK ("simulation" = ("source" = 'SIMULATED')),
  CONSTRAINT "LocationObservation_sequence_check" CHECK ("sequence" >= 0)
);
CREATE UNIQUE INDEX "LocationObservation_deviceId_sequence_key" ON "LocationObservation"("deviceId","sequence");
CREATE INDEX "LocationObservation_workerId_timestamp_id_idx" ON "LocationObservation"("workerId","timestamp","id");
CREATE INDEX "LocationObservation_timestamp_id_idx" ON "LocationObservation"("timestamp","id");
CREATE TABLE "WorkerLocationState" (
  "workerId" TEXT NOT NULL PRIMARY KEY REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "observationId" TEXT REFERENCES "LocationObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkerLocationState_observationId_key" ON "WorkerLocationState"("observationId");
CREATE TABLE "LocationMovementEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "workerId" TEXT NOT NULL,
  "observationId" TEXT NOT NULL REFERENCES "LocationObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" TEXT NOT NULL, "zoneId" TEXT, "previousSource" "LocationSource", "source" "LocationSource" NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL, "simulation" BOOLEAN NOT NULL,
  CONSTRAINT "LocationMovementEvent_type_check" CHECK ("type" IN ('ZONE_ENTRY','ZONE_EXIT','SOURCE_CHANGE'))
);
CREATE INDEX "LocationMovementEvent_workerId_timestamp_id_idx" ON "LocationMovementEvent"("workerId","timestamp","id");
CREATE TABLE "LocationPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY, "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "staleSeconds" INTEGER NOT NULL DEFAULT 120, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LocationPolicy_retention_check" CHECK ("retentionDays" BETWEEN 1 AND 3650),
  CONSTRAINT "LocationPolicy_stale_check" CHECK ("staleSeconds" BETWEEN 10 AND 86400)
);
CREATE INDEX "LocationObservation_deviceId_receivedAt_idx" ON "LocationObservation"("deviceId","receivedAt");
