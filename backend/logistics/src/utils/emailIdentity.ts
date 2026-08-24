const normalize = (value?: unknown) => String(value ?? '').trim()

export const DEFAULT_EMAIL_FROM_NAME = 'Kourier Boyz'
export const DEFAULT_EMAIL_FROM_ADDRESS = 'no-reply@kourierboyz.com'

export const getEmailFromAddress = () => normalize(process.env.EMAIL_FROM) || DEFAULT_EMAIL_FROM_ADDRESS

export const getEmailFromName = () => normalize(process.env.EMAIL_FROM_NAME) || DEFAULT_EMAIL_FROM_NAME

export const getEmailAuthUser = () => normalize(process.env.GOOGLE_SMTP_USER) || getEmailFromAddress()

export const getEmailAuthPassword = () => normalize(process.env.GOOGLE_SMTP_PASSWORD)

export const formatEmailFromHeader = () => `"${getEmailFromName()}" <${getEmailFromAddress()}>`

export const getEmailEnvelopeFromAddress = () => getEmailAuthUser()
