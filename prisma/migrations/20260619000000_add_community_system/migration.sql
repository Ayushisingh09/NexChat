-- CreateEnum
CREATE TYPE "CommunityVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CommunityCategory" AS ENUM ('TECHNOLOGY', 'GAMING', 'AI', 'BUSINESS', 'EDUCATION', 'ENTERTAINMENT', 'MUSIC', 'ANIME', 'SPORTS', 'GENERAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'OFFICIAL', 'VERIFIED', 'ORGANIZATION', 'GAMING');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- Community
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "visibility" "CommunityVisibility" NOT NULL DEFAULT 'PRIVATE',
    "category" "CommunityCategory",
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "banner" TEXT,
    "website" TEXT,
    "socialLinks" JSONB DEFAULT '[]',
    "rules" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NONE',
    "verifiedAt" TIMESTAMP(3),
    "customUrl" TEXT,
    "welcomeMessage" TEXT,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalMembersEver" INTEGER NOT NULL DEFAULT 0,
    "weeklyActiveMembers" INTEGER NOT NULL DEFAULT 0,
    "growthRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "highlightCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Community_conversationId_key" ON "Community"("conversationId");
CREATE UNIQUE INDEX "Community_customUrl_key" ON "Community"("customUrl");
CREATE INDEX "Community_visibility_category_idx" ON "Community"("visibility", "category");
CREATE INDEX "Community_reputationScore_idx" ON "Community"("reputationScore");
CREATE INDEX "Community_engagementScore_idx" ON "Community"("engagementScore");
CREATE INDEX "Community_growthRate_idx" ON "Community"("growthRate");

ALTER TABLE "Community" ADD CONSTRAINT "Community_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CustomRole
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#5865F2',
    "permissions" BIGINT NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomRole_communityId_name_key" ON "CustomRole"("communityId", "name");
CREATE INDEX "CustomRole_communityId_idx" ON "CustomRole"("communityId");

ALTER TABLE "CustomRole" ADD CONSTRAINT "CustomRole_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CustomRoleMember
CREATE TABLE "CustomRoleMember" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomRoleMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomRoleMember_participantId_key" ON "CustomRoleMember"("participantId");
CREATE INDEX "CustomRoleMember_roleId_idx" ON "CustomRoleMember"("roleId");

ALTER TABLE "CustomRoleMember" ADD CONSTRAINT "CustomRoleMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomRoleMember" ADD CONSTRAINT "CustomRoleMember_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityEvent
CREATE TABLE "CommunityEvent" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'MEETING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "maxAttendees" INTEGER,
    "createdById" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityEvent_communityId_status_idx" ON "CommunityEvent"("communityId", "status");
CREATE INDEX "CommunityEvent_startsAt_idx" ON "CommunityEvent"("startsAt");

ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityEventAttendee
CREATE TABLE "CommunityEventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rsvp" TEXT NOT NULL DEFAULT 'GOING',
    "reminded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityEventAttendee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityEventAttendee_eventId_userId_key" ON "CommunityEventAttendee"("eventId", "userId");

ALTER TABLE "CommunityEventAttendee" ADD CONSTRAINT "CommunityEventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityEventAttendee" ADD CONSTRAINT "CommunityEventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityRating
CREATE TABLE "CommunityRating" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityRating_communityId_userId_key" ON "CommunityRating"("communityId", "userId");
CREATE INDEX "CommunityRating_communityId_score_idx" ON "CommunityRating"("communityId", "score");

ALTER TABLE "CommunityRating" ADD CONSTRAINT "CommunityRating_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRating" ADD CONSTRAINT "CommunityRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityAchievement
CREATE TABLE "CommunityAchievement" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB,

    CONSTRAINT "CommunityAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityAchievement_communityId_type_key" ON "CommunityAchievement"("communityId", "type");
CREATE INDEX "CommunityAchievement_communityId_idx" ON "CommunityAchievement"("communityId");

ALTER TABLE "CommunityAchievement" ADD CONSTRAINT "CommunityAchievement_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityHighlight
CREATE TABLE "CommunityHighlight" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "promotedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityHighlight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityHighlight_communityId_messageId_key" ON "CommunityHighlight"("communityId", "messageId");
CREATE INDEX "CommunityHighlight_communityId_reactionCount_idx" ON "CommunityHighlight"("communityId", "reactionCount");

ALTER TABLE "CommunityHighlight" ADD CONSTRAINT "CommunityHighlight_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityHighlight" ADD CONSTRAINT "CommunityHighlight_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityLeaderboardEntry
CREATE TABLE "CommunityLeaderboardEntry" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "metadata" JSONB,
    "weekStart" TIMESTAMP(3),
    "monthStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityLeaderboardEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityLeaderboardEntry_communityId_period_type_rank_idx" ON "CommunityLeaderboardEntry"("communityId", "period", "type", "rank");

ALTER TABLE "CommunityLeaderboardEntry" ADD CONSTRAINT "CommunityLeaderboardEntry_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityLeaderboardEntry" ADD CONSTRAINT "CommunityLeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityAuditLog
CREATE TABLE "CommunityAuditLog" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityAuditLog_communityId_createdAt_idx" ON "CommunityAuditLog"("communityId", "createdAt");

ALTER TABLE "CommunityAuditLog" ADD CONSTRAINT "CommunityAuditLog_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityAuditLog" ADD CONSTRAINT "CommunityAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ModSettings
CREATE TABLE "ModSettings" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "profanityFilter" BOOLEAN NOT NULL DEFAULT true,
    "spamDetection" BOOLEAN NOT NULL DEFAULT true,
    "linkProtection" BOOLEAN NOT NULL DEFAULT false,
    "slowModeSeconds" INTEGER NOT NULL DEFAULT 0,
    "capsLimit" INTEGER NOT NULL DEFAULT 0,
    "repeatedCharLimit" INTEGER NOT NULL DEFAULT 0,
    "minAccountAgeDays" INTEGER NOT NULL DEFAULT 0,
    "requireVerifiedEmail" BOOLEAN NOT NULL DEFAULT false,
    "maxJoinsPerMinute" INTEGER NOT NULL DEFAULT 10,
    "autoKickOnJoinRaid" BOOLEAN NOT NULL DEFAULT false,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModSettings_communityId_key" ON "ModSettings"("communityId");

ALTER TABLE "ModSettings" ADD CONSTRAINT "ModSettings_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityBan
CREATE TABLE "CommunityBan" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "bannedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityBan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityBan_communityId_userId_key" ON "CommunityBan"("communityId", "userId");
CREATE INDEX "CommunityBan_communityId_idx" ON "CommunityBan"("communityId");

ALTER TABLE "CommunityBan" ADD CONSTRAINT "CommunityBan_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityBan" ADD CONSTRAINT "CommunityBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityBan" ADD CONSTRAINT "CommunityBan_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunityReport
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolverId" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityReport_communityId_status_idx" ON "CommunityReport"("communityId", "status");
CREATE INDEX "CommunityReport_targetType_targetId_idx" ON "CommunityReport"("targetType", "targetId");

ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ModAction
CREATE TABLE "ModAction" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "durationMs" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModAction_communityId_createdAt_idx" ON "ModAction"("communityId", "createdAt");
CREATE INDEX "ModAction_targetId_idx" ON "ModAction"("targetId");

ALTER TABLE "ModAction" ADD CONSTRAINT "ModAction_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModAction" ADD CONSTRAINT "ModAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModAction" ADD CONSTRAINT "ModAction_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add highlightScore to Message
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "highlightScore" INTEGER NOT NULL DEFAULT 0;
