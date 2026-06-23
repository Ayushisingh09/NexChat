-- Drop KeyBackup table
DROP TABLE "KeyBackup";

-- Drop publicKey column from User
ALTER TABLE "User" DROP COLUMN "publicKey";
