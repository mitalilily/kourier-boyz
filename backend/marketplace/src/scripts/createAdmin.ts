import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from '../models/User'

dotenv.config()

const createAdmin = async () => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not defined in .env')
    await mongoose.connect(process.env.DATABASE_URL)
    console.log('Connected to PostgreSQL')

    // Check if admin already exists (check both possible emails for backward compatibility)
    const existingAdmin =
      (await User.findOne({ email: 'admin@kourierboyz.com' }))
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email)
      process.exit(0)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('Admin@123!', 10)

    // Create admin user
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@kourierboyz.com',
      password: hashedPassword,
      role: 'super-admin',
      isEmailVerified: true, // Auto-verify admin users
    })

    console.log('Admin user created successfully:', adminUser.email)
    process.exit(0)
  } catch (error) {
    console.error('Error creating admin:', error)
    process.exit(1)
  }
}

createAdmin()
import '../database/postgresMongoose'
