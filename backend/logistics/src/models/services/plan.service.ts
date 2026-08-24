// src/services/plans.service.ts
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../client'
import { plans } from '../schema/plans'
import { userPlans } from '../schema/userPlans'
import { users } from '../schema/users'
import { b2bAdditionalCharges, b2bOverheadRules, b2bZoneToZoneRates } from '../schema/zones'

export type PlanBusinessType = 'b2c' | 'b2b' | 'international'

export const normalizePlanBusinessType = (value?: string | null): PlanBusinessType =>
  String(value ?? '').trim().toLowerCase() === 'b2b'
    ? 'b2b'
    : String(value ?? '').trim().toLowerCase() === 'international'
      ? 'international'
      : 'b2c'

interface GetPlansOptions {
  status?: 'active' | 'inactive'
  businessType?: PlanBusinessType
}

let ensurePlanSplitSetupPromise: Promise<void> | null = null

const ensurePlanSplitSetup = async () => {
  if (!ensurePlanSplitSetupPromise) {
    ensurePlanSplitSetupPromise = (async () => {
      await db.execute(sql.raw(`
        ALTER TABLE "plans"
        ADD COLUMN IF NOT EXISTS "business_type" varchar(20) NOT NULL DEFAULT 'b2c';
      `))

      await db.execute(sql.raw(`
        ALTER TABLE "plans"
        ALTER COLUMN "business_type" TYPE varchar(20);
      `))

      await db.execute(sql.raw(`
        UPDATE "plans"
        SET "business_type" = 'b2c'
        WHERE "business_type" IS NULL OR btrim("business_type") = '';
      `))

      await db.execute(sql.raw(`
        ALTER TABLE "user_plans"
        ADD COLUMN IF NOT EXISTS "business_type" varchar(20) NOT NULL DEFAULT 'b2c';
      `))

      await db.execute(sql.raw(`
        ALTER TABLE "user_plans"
        ALTER COLUMN "business_type" TYPE varchar(20);
      `))

      await db.execute(sql.raw(`
        UPDATE "user_plans" up
        SET "business_type" = CASE
          WHEN p."business_type" = 'b2b' THEN 'b2b'
          ELSE 'b2c'
        END
        FROM "plans" p
        WHERE p."id" = up."plan_id"
          AND (up."business_type" IS NULL OR btrim(up."business_type") = '');
      `))

      await db.execute(sql.raw(`
        UPDATE "user_plans"
        SET "business_type" = 'b2c'
        WHERE "business_type" IS NULL OR btrim("business_type") = '';
      `))

      await db.execute(sql.raw(`
        ALTER TABLE "user_plans" DROP CONSTRAINT IF EXISTS "user_plans_userId_key";
        ALTER TABLE "user_plans" DROP CONSTRAINT IF EXISTS "user_plans_userId_unique";
        DROP INDEX IF EXISTS "user_plans_user_business_type_unique";
        CREATE UNIQUE INDEX "user_plans_user_business_type_unique"
        ON "user_plans" ("userId", "business_type");
      `))

      await db.execute(sql.raw(`
        DO $$
        DECLARE
          b2b_basic_plan_id uuid;
        BEGIN
          SELECT "id"
          INTO b2b_basic_plan_id
          FROM "plans"
          WHERE lower(btrim("name")) = 'basic'
            AND "business_type" = 'b2b'
          ORDER BY "created_at" DESC NULLS LAST
          LIMIT 1;

          IF b2b_basic_plan_id IS NULL THEN
            INSERT INTO "plans" ("name", "description", "business_type", "is_active", "created_at")
            VALUES (
              'Basic',
              'Default B2B plan assigned automatically',
              'b2b',
              true,
              NOW()
            )
            RETURNING "id" INTO b2b_basic_plan_id;
          END IF;

          INSERT INTO "user_plans" ("userId", "plan_id", "business_type", "assigned_at", "is_active")
          SELECT
            preserved."userId",
            preserved."plan_id",
            'b2c',
            COALESCE(preserved."assigned_at", NOW()),
            COALESCE(preserved."is_active", true)
          FROM (
            SELECT DISTINCT ON (up."userId")
              up."userId",
              up."plan_id",
              up."assigned_at",
              up."is_active"
            FROM "user_plans" up
            LEFT JOIN "plans" p ON p."id" = up."plan_id"
            WHERE COALESCE(NULLIF(btrim(up."business_type"), ''), 'b2c') = 'b2c'
               OR COALESCE(p."business_type", 'b2c') = 'b2c'
            ORDER BY up."userId", up."assigned_at" DESC NULLS LAST, up."id" DESC
          ) preserved
          WHERE NOT EXISTS (
            SELECT 1
            FROM "user_plans" existing_b2c
            WHERE existing_b2c."userId" = preserved."userId"
              AND existing_b2c."business_type" = 'b2c'
          );

          UPDATE "user_plans" up
          SET
            "plan_id" = b2b_basic_plan_id,
            "assigned_at" = NOW(),
            "is_active" = true
          WHERE up."business_type" = 'b2b'
            AND EXISTS (
              SELECT 1
              FROM "plans" p
              WHERE p."id" = up."plan_id"
                AND COALESCE(p."business_type", 'b2c') <> 'b2b'
            );

          INSERT INTO "user_plans" ("userId", "plan_id", "business_type", "assigned_at", "is_active")
          SELECT
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

          IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'kourier_boyz_b2b_zone_to_zone_rates'
          ) THEN
            UPDATE "kourier_boyz_b2b_zone_to_zone_rates"
            SET "plan_id" = b2b_basic_plan_id
            WHERE "plan_id" IS NULL;
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'kourier_boyz_b2b_additional_charges'
          ) THEN
            UPDATE "kourier_boyz_b2b_additional_charges"
            SET "plan_id" = b2b_basic_plan_id
            WHERE "plan_id" IS NULL;
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'kourier_boyz_b2b_overhead_rules'
          ) THEN
            UPDATE "kourier_boyz_b2b_overhead_rules"
            SET "plan_id" = b2b_basic_plan_id
            WHERE "plan_id" IS NULL;
          END IF;
        END $$;
      `))
    })().catch((error) => {
      ensurePlanSplitSetupPromise = null
      throw error
    })
  }

  return ensurePlanSplitSetupPromise
}

const getPlansByBusinessType = async (businessType: PlanBusinessType, includeInactive = false) => {
  const conditions = [eq(plans.business_type, businessType)]
  if (!includeInactive) {
    conditions.push(eq(plans.is_active, true))
  }

  return db.select().from(plans).where(and(...conditions)).orderBy(desc(plans.created_at))
}

export const getPlanById = async (planId: string) => {
  await ensurePlanSplitSetup()
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1)
  return plan ?? null
}

export const getDefaultPlanByBusinessType = async (
  businessType: PlanBusinessType,
  excludePlanId?: string,
) => {
  const candidates = await getPlansByBusinessType(businessType)
  const filteredCandidates = excludePlanId
    ? candidates.filter((plan) => plan.id !== excludePlanId)
    : candidates

  const basicPlan = filteredCandidates.find((plan) => plan.name.trim().toLowerCase() === 'basic')
  return basicPlan ?? filteredCandidates[0] ?? null
}

export const getUserPlanAssignment = async (userId: string, businessType: PlanBusinessType) => {
  await ensurePlanSplitSetup()
  const [assignment] = await db
    .select({
      id: userPlans.id,
      userId: userPlans.userId,
      plan_id: userPlans.plan_id,
      business_type: userPlans.business_type,
      assigned_at: userPlans.assigned_at,
      is_active: userPlans.is_active,
      planName: plans.name,
    })
    .from(userPlans)
    .leftJoin(plans, eq(plans.id, userPlans.plan_id))
    .where(
      and(
        eq(userPlans.userId, userId),
        eq(userPlans.business_type, businessType),
        eq(userPlans.is_active, true),
      ),
    )
    .limit(1)

  return assignment ?? null
}

export const getUserPlanId = async (userId: string, businessType: PlanBusinessType) => {
  const assignment = await getUserPlanAssignment(userId, businessType)
  return assignment?.plan_id ?? null
}

export const listUserPlanAssignments = async (userId: string) => {
  await ensurePlanSplitSetup()
  return db
    .select({
      id: userPlans.id,
      userId: userPlans.userId,
      plan_id: userPlans.plan_id,
      business_type: userPlans.business_type,
      assigned_at: userPlans.assigned_at,
      is_active: userPlans.is_active,
      planName: plans.name,
    })
    .from(userPlans)
    .leftJoin(plans, eq(plans.id, userPlans.plan_id))
    .where(eq(userPlans.userId, userId))
}

const seedDefaultB2BAssignmentsAndRates = async (planId: string) => {
  await db.transaction(async (tx) => {
    const allUsers = await tx.select({ id: users.id }).from(users)
    const existingAssignments = await tx
      .select({ userId: userPlans.userId })
      .from(userPlans)
      .where(eq(userPlans.business_type, 'b2b'))

    const existingUserIds = new Set(existingAssignments.map((assignment) => assignment.userId))
    const missingAssignments = allUsers
      .filter((user) => !existingUserIds.has(user.id))
      .map((user) => ({
        userId: user.id,
        plan_id: planId,
        business_type: 'b2b' as const,
        is_active: true,
      }))

    if (missingAssignments.length > 0) {
      await tx.insert(userPlans).values(missingAssignments)
    }

    await tx
      .update(b2bZoneToZoneRates)
      .set({ plan_id: planId, updated_at: new Date() })
      .where(isNull(b2bZoneToZoneRates.plan_id))

    await tx
      .update(b2bAdditionalCharges)
      .set({ plan_id: planId, updated_at: new Date() })
      .where(isNull(b2bAdditionalCharges.plan_id))

    await tx
      .update(b2bOverheadRules)
      .set({ plan_id: planId, updated_at: new Date() })
      .where(isNull(b2bOverheadRules.plan_id))
  })
}

export const PlansService = {
  getAll: async (options?: GetPlansOptions) => {
    await ensurePlanSplitSetup()
    const conditions: any[] = []

    if (options?.businessType) {
      conditions.push(eq(plans.business_type, normalizePlanBusinessType(options.businessType)))
    }

    if (options?.status === 'active') {
      conditions.push(eq(plans.is_active, true))
    } else if (options?.status === 'inactive') {
      conditions.push(eq(plans.is_active, false))
    }

    return db
      .select()
      .from(plans)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(plans.created_at))
  },

  create: async (data: { name: string; description?: string; business_type?: PlanBusinessType }) => {
    await ensurePlanSplitSetup()
    const businessType = normalizePlanBusinessType(data.business_type)
    const existingTypedPlans =
      businessType === 'b2b'
        ? await db
            .select({ id: plans.id })
            .from(plans)
            .where(eq(plans.business_type, 'b2b'))
            .limit(1)
        : []

    const [newPlan] = await db
      .insert(plans)
      .values({
        name: data.name,
        description: data.description,
        business_type: businessType,
      })
      .returning()

    if (businessType === 'b2b' && existingTypedPlans.length === 0) {
      await seedDefaultB2BAssignmentsAndRates(newPlan.id)
    }

    return newPlan
  },

  update: async (
    id: string,
    data: { name?: string; description?: string; is_active?: boolean; business_type?: PlanBusinessType },
  ) => {
    await ensurePlanSplitSetup()
    const { name, description, is_active } = data
    const [updated] = await db
      .update(plans)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(is_active !== undefined && { is_active }),
      })
      .where(eq(plans.id, id))
      .returning()
    return updated
  },

  deactivate: async (planId: string) => {
    try {
      await ensurePlanSplitSetup()
      const planToDeactivate = await getPlanById(planId)
      if (!planToDeactivate) {
        throw new Error('Plan not found')
      }

      const businessType = normalizePlanBusinessType(planToDeactivate.business_type)
      const fallbackPlan =
        businessType === 'international'
          ? null
          : await getDefaultPlanByBusinessType(businessType, planId)

      if (businessType !== 'international' && !fallbackPlan) {
        throw new Error('No fallback plan available for this business type')
      }

      const [deactivatedPlan] = await db
        .update(plans)
        .set({ is_active: false })
        .where(eq(plans.id, planId))
        .returning()

      if (fallbackPlan) {
        await db
          .update(userPlans)
          .set({ plan_id: fallbackPlan.id })
          .where(and(eq(userPlans.plan_id, planId), eq(userPlans.business_type, businessType)))
      }

      return deactivatedPlan
    } catch (err) {
      console.error('Failed to deactivate plan:', err)
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  },

  assignOrUpdateUserPlan: async (userId: string, planId: string, businessType?: PlanBusinessType) => {
    await ensurePlanSplitSetup()
    const plan = await getPlanById(planId)
    if (!plan) {
      throw new Error('Plan not found')
    }

    const normalizedBusinessType = normalizePlanBusinessType(
      businessType ?? plan.business_type ?? 'b2c',
    )

    if (normalizePlanBusinessType(plan.business_type) !== normalizedBusinessType) {
      throw new Error('Selected plan does not match the requested business type')
    }

    const existing = await db
      .select()
      .from(userPlans)
      .where(and(eq(userPlans.userId, userId), eq(userPlans.business_type, normalizedBusinessType)))
      .limit(1)

    if (existing.length > 0) {
      const [updated] = await db
        .update(userPlans)
        .set({ plan_id: planId, business_type: normalizedBusinessType, is_active: true })
        .where(
          and(eq(userPlans.userId, userId), eq(userPlans.business_type, normalizedBusinessType)),
        )
        .returning()
      return updated
    }

    const [inserted] = await db
      .insert(userPlans)
      .values({
        userId,
        plan_id: planId,
        business_type: normalizedBusinessType,
        is_active: true,
      })
      .returning()
    return inserted
  },
}

export { ensurePlanSplitSetup }
