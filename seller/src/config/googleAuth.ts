export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Use "postmessage" for OAuth redirect URI (required for @react-oauth/google auth-code flow)
// This tells Google to use postMessage instead of a traditional redirect
export const GOOGLE_REDIRECT_URI = 'postmessage'

if (!GOOGLE_CLIENT_ID) {
  console.warn('VITE_GOOGLE_CLIENT_ID is not set. Google OAuth will not work.')
}

export const isGoogleOAuthEnabled = !!GOOGLE_CLIENT_ID
