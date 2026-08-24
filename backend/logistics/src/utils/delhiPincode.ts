export const isDelhiPincode = (value: string | number | null | undefined) =>
  /^110\d{3}$/.test(String(value ?? '').trim())
