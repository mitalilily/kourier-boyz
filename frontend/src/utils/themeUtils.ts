import type { ThemeConfig } from './themes'

/**
 * Applies theme CSS variables to the document root
 */
export const applyTheme = (theme: ThemeConfig | null) => {
  const root = document.documentElement

  if (theme) {
    root.style.setProperty('--theme-primary', theme.colors.primary)
    root.style.setProperty('--theme-secondary', theme.colors.secondary)
    root.style.setProperty('--theme-accent', theme.colors.accent)
    root.style.setProperty('--theme-background', theme.colors.background)
    root.style.setProperty('--theme-surface', theme.colors.surface)
    root.style.setProperty('--theme-text', theme.colors.text)
    root.style.setProperty('--theme-text-secondary', theme.colors.textSecondary)
    root.style.setProperty('--theme-border', theme.colors.border)
    root.style.setProperty('--theme-border-radius', theme.styles.borderRadius || '0.75rem')
    // Set gradient based on theme style
    const gradient = `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`
    root.style.setProperty('--theme-gradient', gradient)
  } else {
    // Reset to defaults
    root.style.setProperty('--theme-primary', '#2563eb')
    root.style.setProperty('--theme-secondary', '#10b981')
    root.style.setProperty('--theme-accent', '#f59e0b')
    root.style.setProperty('--theme-background', '#f9fafb')
    root.style.setProperty('--theme-surface', '#ffffff')
    root.style.setProperty('--theme-text', '#111827')
    root.style.setProperty('--theme-text-secondary', '#6b7280')
    root.style.setProperty('--theme-border', '#e5e7eb')
    root.style.setProperty('--theme-border-radius', '0.75rem')
    root.style.setProperty('--theme-gradient', 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)')
  }
}

/**
 * Gets theme-aware CSS variable value
 */
export const getThemeVar = (property: string, fallback?: string): string => {
  return `var(--theme-${property}, ${fallback || 'inherit'})`
}

/**
 * Gets theme-aware style object for common patterns
 */
export const getThemeStyles = (theme: ThemeConfig | null) => {
  if (!theme) {
    return {
      primary: 'var(--theme-primary)',
      secondary: 'var(--theme-secondary)',
      accent: 'var(--theme-accent)',
      background: 'var(--theme-background)',
      surface: 'var(--theme-surface)',
      text: 'var(--theme-text)',
      textSecondary: 'var(--theme-text-secondary)',
      border: 'var(--theme-border)',
      borderRadius: 'var(--theme-border-radius)',
      gradient: 'var(--theme-gradient)',
    }
  }

  return {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    accent: theme.colors.accent,
    background: theme.colors.background,
    surface: theme.colors.surface,
    text: theme.colors.text,
    textSecondary: theme.colors.textSecondary,
    border: theme.colors.border,
    borderRadius: theme.styles.borderRadius || '0.75rem',
    gradient: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
  }
}
