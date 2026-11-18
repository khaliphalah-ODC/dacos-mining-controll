CREATE TABLE "SimulatedSosAction" ("id" TEXT PRIMARY KEY,"incidentId" TEXT NOT NULL REFERENCES "OperationalIncident"("id"),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "SimulatedSosAction_incidentId_idx" ON "SimulatedSosAction"("incidentId");
INSERT INTO "SimulatedSosAction" ("id","incidentId") SELECT "sosEventId","id" FROM "OperationalIncident" WHERE "sosEventId" IS NOT NULL;
