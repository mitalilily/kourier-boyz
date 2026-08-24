const normalizeErrorText = (value: unknown) => String(value || '').trim()

export const isInternalProviderBalanceIssue = (value: unknown) => {
  const normalized = normalizeErrorText(value).toLowerCase()
  return (
    (normalized.includes('wallet balance') && normalized.includes('less than')) ||
    normalized.includes('insufficient balance') ||
    normalized.includes('low balance') ||
    (normalized.includes('client wallet') && normalized.includes('balance')) ||
    (normalized.includes('recharge') && normalized.includes('wallet'))
  )
}

export const getMerchantSafeOperationalError = (
  value: unknown,
  fallback: string | null = 'We could not complete this step right now. Our operations team has been notified.',
) => {
  const normalized = normalizeErrorText(value)
  if (!normalized) return fallback
  if (isInternalProviderBalanceIssue(normalized)) {
    return fallback
  }
  return normalized
}
