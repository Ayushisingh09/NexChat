-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSeenVisibility" TEXT NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
