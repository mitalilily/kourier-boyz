// Theme configurations for seller microsites
export interface ThemeConfig {
  id: string
  name: string
  description: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    textSecondary: string
    border: string
  }
  styles: {
    borderRadius: string
    headerStyle: 'gradient' | 'solid' | 'minimal'
    cardStyle: 'elevated' | 'flat' | 'bordered'
  }
  preview: {
    primaryColor: string
    secondaryColor: string
  }
}

export const themes: ThemeConfig[] = [
  {
    id: 'modern',
    name: 'Azure Blue',
    description: 'Professional blue gradient 🌊',
    colors: {
      primary: '#1353A4',
      secondary: '#10b981',
      accent: '#f59e0b',
      background: '#f9fafb',
      surface: '#ffffff',
      text: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
    },
    styles: {
      borderRadius: '0.75rem',
      headerStyle: 'gradient',
      cardStyle: 'elevated',
    },
    preview: {
      primaryColor: '#1353A4',
      secondaryColor: '#10b981',
    },
  },
  {
    id: 'classic',
    name: 'Royal Amethyst',
    description: 'Elegant purple & pink ✨',
    colors: {
      primary: '#8b5cf6',
      secondary: '#ec4899',
      accent: '#f97316',
      background: '#fef3c7',
      surface: '#ffffff',
      text: '#1f2937',
      textSecondary: '#6b7280',
      border: '#d1d5db',
    },
    styles: {
      borderRadius: '0.5rem',
      headerStyle: 'solid',
      cardStyle: 'bordered',
    },
    preview: {
      primaryColor: '#8b5cf6',
      secondaryColor: '#ec4899',
    },
  },
  {
    id: 'minimal',
    name: 'Monochrome',
    description: 'Clean minimalist design ⚫⚪',
    colors: {
      primary: '#1f2937',
      secondary: '#4b5563',
      accent: '#9ca3af',
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
    },
    styles: {
      borderRadius: '0.25rem',
      headerStyle: 'minimal',
      cardStyle: 'flat',
    },
    preview: {
      primaryColor: '#1f2937',
      secondaryColor: '#4b5563',
    },
  },
  {
    id: 'vibrant',
    name: 'Crimson Fire',
    description: 'Bold & energetic 🔥',
    colors: {
      primary: '#ef4444',
      secondary: '#f59e0b',
      accent: '#10b981',
      background: '#fef2f2',
      surface: '#ffffff',
      text: '#111827',
      textSecondary: '#6b7280',
      border: '#fecaca',
    },
    styles: {
      borderRadius: '1rem',
      headerStyle: 'gradient',
      cardStyle: 'elevated',
    },
    preview: {
      primaryColor: '#ef4444',
      secondaryColor: '#f59e0b',
    },
  },
  {
    id: 'elegant',
    name: 'Midnight Elegance',
    description: 'Sophisticated luxury 🌙',
    colors: {
      primary: '#1e40af',
      secondary: '#7c3aed',
      accent: '#be185d',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
      textSecondary: '#64748b',
      border: '#cbd5e1',
    },
    styles: {
      borderRadius: '0.5rem',
      headerStyle: 'solid',
      cardStyle: 'elevated',
    },
    preview: {
      primaryColor: '#1e40af',
      secondaryColor: '#7c3aed',
    },
  },
  {
    id: 'nature',
    name: 'Emerald Garden',
    description: 'Fresh eco-friendly 🌿',
    colors: {
      primary: '#059669',
      secondary: '#0d9488',
      accent: '#84cc16',
      background: '#f0fdf4',
      surface: '#ffffff',
      text: '#064e3b',
      textSecondary: '#6b7280',
      border: '#a7f3d0',
    },
    styles: {
      borderRadius: '1rem',
      headerStyle: 'gradient',
      cardStyle: 'bordered',
    },
    preview: {
      primaryColor: '#059669',
      secondaryColor: '#0d9488',
    },
  },
]

export const getThemeById = (id: string): ThemeConfig => {
  return themes.find((theme) => theme.id === id) || themes[0]
}

export const getDefaultTheme = (): ThemeConfig => {
  return themes[0]
}
