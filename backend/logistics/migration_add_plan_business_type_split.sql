ALTER TABLE "plans"
ADD COLUMN IF NOT EXISTS "business_type" varchar(10) NOT NULL DEFAULT 'b2c';

UPDATE "plans"
SET "business_type" = 'b2c'
WHERE "business_type" IS NULL;

ALTER TABLE "user_plans"
ADD COLUMN IF NOT EXISTS "business_type" varchar(10) NOT NULL DEFAULT 'b2c';

UPDATE "user_plans"
SET "business_type" = 'b2c'
WHERE "business_type" IS NULL;

ALTER TABLE "user_plans" DROP CONSTRAINT IF EXISTS "user_plans_userId_key";
ALTER TABLE "user_plans" DROP CONSTRAINT IF EXISTS "user_plans_userId_unique";

DROP INDEX IF EXISTS "user_plans_user_business_type_unique";
CREATE UNIQUE INDEX "user_plans_user_business_type_unique"
ON "user_plans" ("userId", "business_type");

DO $$
DECLARE
  b2b_basic_plan_id uuid;
BEGIN
  SELECT "id"
  INTO b2b_basic_plan_id
  FROM "plans"
  WHERE lower("name") = 'basic'
    AND "business_type" = 'b2b'
  ORDER BY "created_at" DESC NULLS LAST
  LIMIT 1;

  IF b2b_basic_plan_id IS NULL THEN
    INSERT INTO "plans" ("id", "name", "description", "business_type", "is_active", "created_at")
    VALUES (
      gen_random_uuid(),
      'Basic',
      'Default B2B plan assigned to all users during B2B plan split migration',
      'b2b',
      true,
      NOW()
    )
    RETURNING "id" INTO b2b_basic_plan_id;
  END IF;

  INSERT INTO "user_plans" ("id", "userId", "plan_id", "business_type", "assigned_at", "is_active")
  SELECT
    gen_random_uuid(),
    u."id",
    b2b_basic_plan_id,
    'b2b',
    NOW(),
    true
  FROM "users" u
  WHERE NOT EXISTS (
    SELECT 1
    FROM "user_plans" up
    WHERE up."userId" = u."id"
      AND up."business_type" = 'b2b'
  );

  UPDATE "kourier_boyz_b2b_zone_to_zone_rates"
  SET "plan_id" = b2b_basic_plan_id
  WHERE "plan_id" IS NULL;

  UPDATE "kourier_boyz_b2b_additional_charges"
  SET "plan_id" = b2b_basic_plan_id
  WHERE "plan_id" IS NULL;

  UPDATE "kourier_boyz_b2b_overhead_rules"
  SET "plan_id" = b2b_basic_plan_id
  WHERE "plan_id" IS NULL;
END $$;
