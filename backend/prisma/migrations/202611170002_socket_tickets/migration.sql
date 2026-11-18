CREATE TABLE "SocketTicket" ("id" TEXT PRIMARY KEY,"sessionId" TEXT NOT NULL REFERENCES "Session"("id") ON DELETE CASCADE,"expiresAt" TIMESTAMP(3) NOT NULL,"sessionExpiresAt" TIMESTAMP(3) NOT NULL,"usedAt" TIMESTAMP(3));
CREATE INDEX "SocketTicket_sessionId_expiresAt_idx" ON "SocketTicket"("sessionId","expiresAt");
