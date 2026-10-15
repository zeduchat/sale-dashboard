-- CreateTable
CREATE TABLE "MasterKey" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "keyHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedById" TEXT,

    CONSTRAINT "MasterKey_pkey" PRIMARY KEY ("id")
);
