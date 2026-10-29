CREATE TABLE "DeviceAccessConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passwordHash" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceAccessConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceSession" (
    "tokenHash" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "DeviceSession_expiresAt_idx" ON "DeviceSession"("expiresAt");
