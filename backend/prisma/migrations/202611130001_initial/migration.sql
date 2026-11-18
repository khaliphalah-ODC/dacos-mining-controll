-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "geometry" JSONB NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "workerId" TEXT,
    "zoneId" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "workerId" TEXT,
    "deviceId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "simulation" BOOLEAN NOT NULL,
    "quality" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "workerId" TEXT,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "simulation" BOOLEAN NOT NULL,
    "quality" TEXT NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "workerId" TEXT,
    "zoneId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "simulation" BOOLEAN NOT NULL,
    "quality" TEXT NOT NULL,
    "timeline" JSONB NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reading_kind_zoneId_idx" ON "Reading"("kind", "zoneId");

-- CreateIndex
CREATE INDEX "Reading_workerId_idx" ON "Reading"("workerId");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

