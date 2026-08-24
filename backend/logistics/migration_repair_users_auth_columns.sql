-- Keep older production databases compatible with the current Drizzle users schema.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "googleId" varchar(64),
  ADD COLUMN IF NOT EXISTS "pendingEmail" varchar(100),
  ADD COLUMN IF NOT EXISTS "pendingPhone" varchar(20),
  ADD COLUMN IF NOT EXISTS "passwordHash" varchar(200),
  ADD COLUMN IF NOT EXISTS "refreshToken" varchar(500),
  ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" timestamp,
  ADD COLUMN IF NOT EXISTS "previousRefreshToken" varchar(500),
  ADD COLUMN IF NOT EXISTS "previousRefreshTokenExpiresAt" timestamp,
  ADD COLUMN IF NOT EXISTS "emailVerified" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "phoneVerified" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "accountVerified" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS "profilePicture" varchar(512),
  ADD COLUMN IF NOT EXISTS "otp" varchar(6),
  ADD COLUMN IF NOT EXISTS "otpExpiresAt" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "emailVerificationToken" varchar(8),
  ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpiresAt" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp with time zone DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique"
  ON "users" ("email")
  WHERE "email" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_unique"
  ON "users" ("phone")
  WHERE "phone" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_unique"
  ON "users" ("googleId")
  WHERE "googleId" IS NOT NULL;
