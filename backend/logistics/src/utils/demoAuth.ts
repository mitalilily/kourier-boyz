export const isDemoOtpEnabled = (configuredValue?: string): boolean =>
  String(configuredValue ?? 'false').trim().toLowerCase() === 'true'
