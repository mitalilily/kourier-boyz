import { pool } from '../models/client'
import { loginAdmin } from '../models/services/adminAuth.service'

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required')
}

loginAdmin(email, password)
  .then((result) => {
    if (result.user.role !== 'admin' || !result.token || !result.refreshToken) {
      throw new Error('Admin login returned an invalid session')
    }
    console.log(`Admin login verified for ${result.user.email}`)
  })
  .catch((error) => {
    console.error('Admin login verification failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
