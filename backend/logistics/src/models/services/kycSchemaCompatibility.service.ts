import { pool } from '../client'

let compatibilityPromise: Promise<void> | null = null

const runKycSchemaCompatibility = async () => {
  await pool.query(`
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
  `)

  await pool.query(`ALTER TYPE "kyc_status" ADD VALUE IF NOT EXISTS 'pending';`)
  await pool.query(`ALTER TYPE "kyc_status" ADD VALUE IF NOT EXISTS 'verification_in_progress';`)
  await pool.query(`ALTER TYPE "kyc_status" ADD VALUE IF NOT EXISTS 'verified';`)
  await pool.query(`ALTER TYPE "kyc_status" ADD VALUE IF NOT EXISTS 'rejected';`)

  await pool.query(`
    ALTER TABLE "kyc"
      ADD COLUMN IF NOT EXISTS "panNumber" varchar(10);
  `)

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'kyc'
          AND column_name = 'status'
          AND udt_name <> 'kyc_status'
      ) THEN
        ALTER TABLE "kyc" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "kyc"
          ALTER COLUMN "status" TYPE "kyc_status"
          USING "status"::text::"kyc_status";
        ALTER TABLE "kyc" ALTER COLUMN "status" SET DEFAULT 'pending'::"kyc_status";
      ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'kyc'
          AND column_name = 'status'
      ) THEN
        ALTER TABLE "kyc" ALTER COLUMN "status" SET DEFAULT 'pending'::"kyc_status";
      END IF;
    END $$;
  `)

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'kyc'
          AND column_name = '  llpAgreementUrl'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'kyc'
          AND column_name = 'llpAgreementUrl'
      ) THEN
        ALTER TABLE "kyc" RENAME COLUMN "  llpAgreementUrl" TO "llpAgreementUrl";
      ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'kyc'
          AND column_name = '  llpAgreementUrl'
      ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'kyc'
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
        WHERE table_schema = current_schema()
          AND table_name = 'kyc'
          AND column_name = 'llpAgreementUrl'
      ) THEN
        ALTER TABLE "kyc" ADD COLUMN "llpAgreementUrl" text;
      END IF;
    END $$;
  `)
}

export const ensureKycSchemaCompatibility = async () => {
  if (!compatibilityPromise) {
    compatibilityPromise = runKycSchemaCompatibility().catch((error) => {
      compatibilityPromise = null
      throw error
    })
  }

  return compatibilityPromise
}
