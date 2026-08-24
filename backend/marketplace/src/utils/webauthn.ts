import type {
  GenerateAuthenticationOptionsOpts,
  GenerateRegistrationOptionsOpts,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import base64url from 'base64url'
import type { IUser } from '../models/User'

const defaultRpName = process.env.WEBAUTHN_RP_NAME || 'Kourier Boyz'
const defaultRpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const defaultOrigin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173'

interface RegistrationOverrides {
  rpID?: string
  rpName?: string
}

interface AuthenticationOverrides {
  rpID?: string
}

interface VerificationOverrides {
  rpID?: string
  origin?: string
}

export const createRegistrationOptions = async (user: IUser, overrides?: RegistrationOverrides) => {
  const userId = String(user._id)
  const rpID = overrides?.rpID || defaultRpID
  const rpName = overrides?.rpName || defaultRpName

  const opts: GenerateRegistrationOptionsOpts = {
    rpName,
    rpID,
    userID: userId,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: (user.passkeys || []).map((passkey) => ({
      id: passkey.credentialID,
      type: 'public-key',
      transports: passkey.transports as any,
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  }

  return generateRegistrationOptions(opts)
}

export const createAuthenticationOptions = async (
  user: IUser,
  overrides?: AuthenticationOverrides,
) => {
  const rpID = overrides?.rpID || defaultRpID
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID,
    timeout: 60_000,
    userVerification: 'preferred',
    allowCredentials: (user.passkeys || []).map((passkey) => ({
      id: passkey.credentialID,
      type: 'public-key',
      transports: passkey.transports as any,
    })),
  }

  return generateAuthenticationOptions(opts)
}

export const createDiscoverableAuthenticationOptions = async (
  overrides?: AuthenticationOverrides,
) => {
  const rpID = overrides?.rpID || defaultRpID
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID,
    timeout: 60_000,
    userVerification: 'preferred',
  }

  return generateAuthenticationOptions(opts)
}

export const verifyRegistration = async (
  user: IUser,
  expectedChallenge: string,
  credential: Parameters<typeof verifyRegistrationResponse>[0]['response'],
  overrides?: VerificationOverrides,
): Promise<VerifiedRegistrationResponse> => {
  const expectedOrigin = overrides?.origin || defaultOrigin
  const expectedRPID = overrides?.rpID || defaultRpID

  return verifyRegistrationResponse({
    response: credential,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: true,
  })
}

export const verifyAuthentication = async (
  user: IUser,
  expectedChallenge: string,
  credential: Parameters<typeof verifyAuthenticationResponse>[0]['response'],
  overrides?: VerificationOverrides,
): Promise<VerifiedAuthenticationResponse> => {
  const expectedOrigin = overrides?.origin || defaultOrigin
  const expectedRPID = overrides?.rpID || defaultRpID

  return verifyAuthenticationResponse({
    response: credential,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: true,
    authenticator: findAuthenticatorFromCredentialID(user, credential.rawId),
  })
}

const findAuthenticatorFromCredentialID = (user: IUser, rawId: string | Buffer) => {
  const idBuffer = typeof rawId === 'string' ? base64url.toBuffer(rawId) : rawId
  const authenticator = (user.passkeys || []).find((passkey) =>
    passkey.credentialID.equals(idBuffer),
  )
  if (!authenticator) {
    throw new Error('Authenticator not registered')
  }
  return {
    credentialID: authenticator.credentialID,
    credentialPublicKey: authenticator.credentialPublicKey,
    counter: authenticator.counter,
    transports: authenticator.transports as any,
  }
}

export const updateAuthenticatorCounter = (
  user: IUser,
  rawId: string | Buffer,
  counter: number,
) => {
  const idBuffer = typeof rawId === 'string' ? base64url.toBuffer(rawId) : rawId
  const authenticator = (user.passkeys || []).find((passkey) =>
    passkey.credentialID.equals(idBuffer),
  )
  if (!authenticator) {
    throw new Error('Authenticator not registered')
  }
  authenticator.counter = counter
  authenticator.lastUsedAt = new Date()
}
