const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const namedColorHex = new Map<string, string>([
  ['black', '#000000'],
  ['white', '#ffffff'],
  ['red', '#ff0000'],
  ['blue', '#0000ff'],
  ['green', '#008000'],
  ['yellow', '#ffff00'],
  ['purple', '#800080'],
  ['violet', '#8f00ff'],
  ['orange', '#ffa500'],
  ['brown', '#8b4513'],
  ['pink', '#ffc0cb'],
  ['magenta', '#ff00ff'],
  ['cyan', '#00ffff'],
  ['teal', '#008080'],
  ['navy', '#000080'],
  ['olive', '#808000'],
  ['maroon', '#800000'],
  ['gray', '#808080'],
  ['grey', '#808080'],
  ['silver', '#c0c0c0'],
  ['gold', '#ffd700'],
  ['beige', '#f5f5dc'],
  ['ivory', '#fffff0'],
  ['turquoise', '#40e0d0'],
  ['indigo', '#4b0082'],
  ['lavender', '#e6e6fa'],
  ['coral', '#ff7f50'],
  ['peach', '#ffdab9'],
  ['mint', '#3eb489'],
  ['cream', '#fffdd0'],
])

const normalizeHexInput = (value: string): string | null => {
  const trimmed = value.trim()
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return null
  }

  const match = trimmed.match(HEX_COLOR_PATTERN)
  if (!match) return null

  const hexBody = match[1].toLowerCase()
  if (hexBody.length === 3) {
    return `#${hexBody
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`
  }

  return `#${hexBody}`
}

const generateColorFromName = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
    hash &= hash
  }

  let color = '#'
  for (let i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff
    color += `00${value.toString(16)}`.slice(-2)
  }
  return color
}

export const getColorHex = (input: string): string => {
  if (!input) return '#999999'
  const trimmed = input.trim()
  if (!trimmed) return '#999999'

  const normalizedHex = normalizeHexInput(trimmed)
  if (normalizedHex) return normalizedHex

  const key = trimmed.toLowerCase()
  const mapped = namedColorHex.get(key)
  if (mapped) return mapped

  const generated = generateColorFromName(key)
  namedColorHex.set(key, generated)
  return generated
}

export const registerCustomColor = (name: string, hex: string) => {
  if (!name || !hex) return
  const normalizedHex = normalizeHexInput(hex)
  if (!normalizedHex) return
  namedColorHex.set(name.trim().toLowerCase(), normalizedHex)
}

