-- AlterTable
ALTER TABLE "CipherMessage" ADD COLUMN "promptTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completionTokens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CipherFeedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "reason" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CipherFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CipherFeedback_messageId_key" ON "CipherFeedback"("messageId");

-- CreateIndex
CREATE INDEX "CipherFeedback_feedbackType_createdAt_idx" ON "CipherFeedback"("feedbackType", "createdAt");

-- CreateIndex
CREATE INDEX "CipherFeedback_userId_createdAt_idx" ON "CipherFeedback"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CipherFeedback" ADD CONSTRAINT "CipherFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CipherMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipherFeedback" ADD CONSTRAINT "CipherFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
