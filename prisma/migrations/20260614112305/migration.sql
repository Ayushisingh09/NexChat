-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationSound" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Message_conversationId_pinnedAt_idx" ON "Message"("conversationId", "pinnedAt");
