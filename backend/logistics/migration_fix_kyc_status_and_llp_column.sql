DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
    CREATE TYPE "kyc_status" AS ENUM (
      'pending',
      'verification_in_progress',
      'verified',
      'rejected'
    );
  END IF;
END $$;

ALTER TYPE "kyc_status" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "kyc_status" ADD VALUE IF NOT EXISTS 'verification_in_progress';
ALTER TYPE "kyc_status" ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE "kyc_status" ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE "kyc" ADD COLUMN IF NOT EXISTS "panNumber" varchar(10);

ALTER TABLE "kyc"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "kyc_status" USING "status"::text::"kyc_status",
  ALTER COLUMN "status" SET DEFAULT 'pending'::"kyc_status";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'kyc'
      AND column_name = '  llpAgreementUrl'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'kyc'
      AND column_name = 'llpAgreementUrl'
  ) THEN
    ALTER TABLE "kyc" RENAME COLUMN "  llpAgreementUrl" TO "llpAgreementUrl";
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'kyc'
      AND column_name = '  llpAgreementUrl'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'kyc'
      AND column_name = 'llpAgreementUrl'
  ) THEN
    UPDATE "kyc"
    SET "llpAgreementUrl" = COALESCE("llpAgreementUrl", "  llpAgreementUrl")
    WHERE "llpAgreementUrl" IS NULL
      AND "  llpAgreementUrl" IS NOT NULL;

    ALTER TABLE "kyc" DROP COLUMN "  llpAgreementUrl";
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'kyc'
      AND column_name = 'llpAgreementUrl'
  ) THEN
    ALTER TABLE "kyc" ADD COLUMN "llpAgreementUrl" text;
  END IF;
END $$;
