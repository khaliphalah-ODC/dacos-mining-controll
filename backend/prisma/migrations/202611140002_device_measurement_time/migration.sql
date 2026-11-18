-- Empty connection packets must not refresh retained measurements.
ALTER TABLE "DeviceRegistration" ADD COLUMN IF NOT EXISTS "measurementTimestamp" TIMESTAMP(3);
UPDATE "DeviceRegistration" SET "measurementTimestamp" = "timestamp" WHERE "timestamp" IS NOT NULL;
