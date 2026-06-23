-- CreateTable
CREATE TABLE "CipherConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CipherConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CipherMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL DEFAULT 'nim',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CipherMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CipherUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CipherUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CipherConversation_userId_updatedAt_idx" ON "CipherConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CipherMessage_conversationId_createdAt_idx" ON "CipherMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CipherMessage_userId_createdAt_idx" ON "CipherMessage"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CipherUsage_userId_date_key" ON "CipherUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "CipherUsage_userId_date_idx" ON "CipherUsage"("userId", "date");

-- AddForeignKey
ALTER TABLE "CipherConversation" ADD CONSTRAINT "CipherConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipherMessage" ADD CONSTRAINT "CipherMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CipherConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipherMessage" ADD CONSTRAINT "CipherMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipherUsage" ADD CONSTRAINT "CipherUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
