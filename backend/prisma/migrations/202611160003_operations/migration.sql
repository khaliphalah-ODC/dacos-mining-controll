ALTER TABLE "Worker" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'legacy-demo';
ALTER TABLE "Zone" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'legacy-demo';
CREATE TABLE "OperationalIncident" ("id" TEXT PRIMARY KEY,"deviceId" TEXT,"workerId" TEXT,"severity" TEXT NOT NULL,"message" TEXT NOT NULL,"simulation" BOOLEAN NOT NULL,"status" TEXT NOT NULL DEFAULT 'open',"ownerId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "OperationalIncidentEvent" ("id" TEXT PRIMARY KEY,"incidentId" TEXT NOT NULL REFERENCES "OperationalIncident"("id"),"actorId" TEXT NOT NULL,"action" TEXT NOT NULL,"note" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "OperationalIncidentEvent_incidentId_createdAt_idx" ON "OperationalIncidentEvent"("incidentId","createdAt");
CREATE INDEX "DeviceTelemetry_receivedAt_id_idx" ON "DeviceTelemetry"("receivedAt","id");
