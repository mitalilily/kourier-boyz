// seedAdmin.ts
import bcrypt from 'bcryptjs'
import { or, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../models/client'
import { User } from '../models/services/userService'
import { users } from '../schema/schema'

interface SeedAdminProps {
  phone: string
  password: string
  email?: string
  role?: 'admin' | 'customer' | 'manager'
}

export const seedAdmin = async ({
  phone,
  password,
  email,
  role = 'admin',
}: SeedAdminProps): Promise<User> => {
  const hashedPassword = await bcrypt.hash(password, 10)

  // Check if user already exists by either identifier so credential rotation is repeatable.
  const existing = await db
    .select()
    .from(users)
    .where(email ? or(eq(users.phone, phone), eq(users.email, email)) : eq(users.phone, phone))
  if (existing.length > 0) {
    const [updatedUser] = await db
      .update(users)
      .set({
        email: email ?? existing[0].email,
        passwordHash: hashedPassword,
        role,
        phoneVerified: true,
        emailVerified: !!email || existing[0].emailVerified,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
      .returning()

    return updatedUser as User
  }

  // insert new user
  const [newUser] = await db
    .insert(users)
    .values({
      id: uuidv4(),
      phone,
      email: email ?? null,
      passwordHash: hashedPassword,
      role,
      phoneVerified: true,
      emailVerified: !!email,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  return newUser as User
}

seedAdmin({
  phone: '+916283315911', // valid Indian phone format
  email: 'admin@kourierboyz.com',
  password: 'KourierBoyz2026!',
  role: 'admin',
})
  .then((user) => {
    console.log('Admin user created or already exists:', user)
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error seeding admin:', err)
    process.exit(1)
  })
