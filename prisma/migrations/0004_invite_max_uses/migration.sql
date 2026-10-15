-- AlterTable: multi-use invite codes
ALTER TABLE "Invite" ADD COLUMN "maxUses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "uses" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD COLUMN "inviteId" TEXT;

-- Backfill from the old one-to-one link
UPDATE "User" u SET "inviteId" = i."id" FROM "Invite" i WHERE i."acceptedById" = u."id";
UPDATE "Invite" SET "uses" = 1 WHERE "usedAt" IS NOT NULL;

-- DropForeignKey / DropIndex / DropColumn
ALTER TABLE "Invite" DROP CONSTRAINT "Invite_acceptedById_fkey";
DROP INDEX "Invite_acceptedById_key";
ALTER TABLE "Invite" DROP COLUMN "acceptedById";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
