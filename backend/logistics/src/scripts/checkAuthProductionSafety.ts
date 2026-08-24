import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { isDemoOtpEnabled } from '../utils/demoAuth'
import { resolveTokenSecrets } from '../utils/tokenSecrets'

assert.equal(isDemoOtpEnabled(undefined), false)
assert.equal(isDemoOtpEnabled('false'), false)
assert.equal(isDemoOtpEnabled('true'), true)
assert.equal(isDemoOtpEnabled(' TRUE '), true)

assert.throws(() => resolveTokenSecrets({}), /required/)
assert.throws(
  () => resolveTokenSecrets({ accessTokenSecret: 'access-only' }),
  /required/,
)

const explicitSecrets = resolveTokenSecrets({
  accessTokenSecret: 'access-secret',
  refreshTokenSecret: 'refresh-secret',
})
assert.equal(explicitSecrets.accessSecret, 'access-secret')
assert.equal(explicitSecrets.refreshSecret, 'refresh-secret')

const legacySecrets = resolveTokenSecrets({ jwtSecret: 'legacy-secret' })
assert.notEqual(legacySecrets.accessSecret, legacySecrets.refreshSecret)
assert.equal(legacySecrets.accessSecret.length, 64)
assert.equal(legacySecrets.refreshSecret.length, 64)

const ephemeralSecrets = resolveTokenSecrets({ allowEphemeralFallback: true })
assert.equal(ephemeralSecrets.ephemeral, true)
assert.notEqual(ephemeralSecrets.accessSecret, ephemeralSecrets.refreshSecret)
assert.equal(ephemeralSecrets.accessSecret.length, 64)
assert.equal(ephemeralSecrets.refreshSecret.length, 64)

const anotherEphemeralSet = resolveTokenSecrets({ allowEphemeralFallback: true })
assert.notEqual(ephemeralSecrets.accessSecret, anotherEphemeralSet.accessSecret)
assert.notEqual(ephemeralSecrets.refreshSecret, anotherEphemeralSet.refreshSecret)

const repositoryRoot = path.resolve(__dirname, '../../../..')
const authControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'backend/logistics/src/controllers/authController.ts'),
  'utf8',
)
const otpFormSource = fs.readFileSync(
  path.join(repositoryRoot, 'seller-client/apps/logistics/src/components/auth/OtpForm.tsx'),
  'utf8',
)
const phoneFormSource = fs.readFileSync(
  path.join(repositoryRoot, 'seller-client/apps/logistics/src/components/auth/PhoneForm.tsx'),
  'utf8',
)

assert.doesNotMatch(authControllerSource, /console\.(?:log|info|warn|error)\([^\n]*demo otp/i)
assert.doesNotMatch(otpFormSource, /console\.(?:log|info|warn|error)\([^\n]*demo otp/i)
assert.doesNotMatch(phoneFormSource, /console\.(?:log|info|warn|error)\([^\n]*demo otp/i)
assert.match(authControllerSource, /DEMO_AUTH_SHOW_OTP \?\? 'true'/)
assert.match(authControllerSource, /demoOtpEnabled && user && user\.role !== 'customer'/)
assert.match(otpFormSource, /Demo access code/)
assert.match(otpFormSource, /demoOtp/)
assert.doesNotMatch(phoneFormSource, /Console OTP/)

console.log('Authentication configuration safety checks passed')
