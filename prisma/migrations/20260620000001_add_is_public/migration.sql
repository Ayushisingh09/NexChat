-- Add isPublic column to User table (default false = secure by default)
ALTER TABLE "User" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
