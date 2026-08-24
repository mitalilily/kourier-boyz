import { alpha, createTheme } from '@mui/material/styles'

const BRAND_BLUE = '#B78115'
const BRAND_BLUE_DARK = '#8F650F'
const BRAND_BLUE_LIGHT = '#DFB743'
const BRAND_ORANGE = '#555D61'
const BRAND_ORANGE_DARK = '#303537'
const BRAND_ORANGE_LIGHT = '#9AA1A4'
const BRAND_INK = '#202321'
const BRAND_SLATE = '#4F5552'
const BRAND_MUTED = '#6A706D'
const BRAND_CANVAS = '#F1F2F0'
const BRAND_SURFACE = '#FFFFFF'
const BRAND_SURFACE_ALT = '#F8F8F6'
const BRAND_BORDER = '#D9DCDA'

const theme = createTheme({
  breakpoints: {
    values: {
      xs: 300,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  palette: {
    mode: 'light',
    primary: {
      main: BRAND_BLUE,
      light: BRAND_BLUE_LIGHT,
      dark: BRAND_BLUE_DARK,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: BRAND_ORANGE,
      light: BRAND_ORANGE_LIGHT,
      dark: BRAND_ORANGE_DARK,
      contrastText: '#FFFFFF',
    },
    background: {
      default: BRAND_CANVAS,
      paper: BRAND_SURFACE,
    },
    text: {
      primary: BRAND_INK,
      secondary: BRAND_MUTED,
      disabled: '#AAA4A0',
    },
    divider: BRAND_BORDER,
    error: {
      main: '#C62828',
    },
    warning: {
      main: '#D97706',
    },
    info: {
      main: BRAND_BLUE_LIGHT,
    },
    success: {
      main: '#16A34A',
    },
  },
  shape: {
    borderRadius: 4,
  },
  typography: {
    fontFamily: '"Manrope", "Segoe UI", sans-serif',
    h1: { color: BRAND_INK, fontWeight: 800, letterSpacing: 0 },
    h2: { color: BRAND_INK, fontWeight: 800, letterSpacing: 0 },
    h3: { color: BRAND_INK, fontWeight: 800, letterSpacing: 0 },
    h4: { color: BRAND_INK, fontWeight: 800, letterSpacing: 0 },
    h5: { color: BRAND_INK, fontWeight: 760, letterSpacing: 0 },
    h6: { color: BRAND_INK, fontWeight: 760, letterSpacing: 0 },
    subtitle1: { color: BRAND_SLATE, fontWeight: 700 },
    subtitle2: { color: BRAND_MUTED, fontWeight: 700, letterSpacing: 0 },
    body1: { color: BRAND_SLATE, lineHeight: 1.65 },
    body2: { color: BRAND_MUTED, lineHeight: 1.55 },
    button: { fontWeight: 800, textTransform: 'none', letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'light',
        },
        body: {
          color: BRAND_INK,
          background: BRAND_CANVAS,
        },
        '#root': {
          minHeight: '100vh',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 4,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          backgroundColor: alpha(BRAND_SURFACE, 0.98),
          border: `1px solid ${BRAND_BORDER}`,
          boxShadow: '0 8px 22px rgba(17, 17, 19, 0.06)',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: '0 !important',
          paddingRight: '0 !important',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          paddingInline: 18,
          minHeight: 42,
          fontWeight: 800,
          '&.Mui-disabled': {
            opacity: 0.72,
          },
        },
        containedPrimary: {
          background: BRAND_BLUE,
          color: '#FFFFFF',
          '&:hover': {
            background: BRAND_BLUE_DARK,
            boxShadow: `0 10px 20px ${alpha(BRAND_BLUE, 0.22)}`,
          },
        },
        containedSecondary: {
          background: BRAND_ORANGE,
          color: '#FFFFFF',
          '&:hover': {
            background: BRAND_ORANGE_DARK,
            boxShadow: `0 10px 20px ${alpha(BRAND_ORANGE, 0.22)}`,
          },
        },
        outlined: {
          borderWidth: 1,
          borderColor: alpha(BRAND_INK, 0.12),
          color: BRAND_INK,
          backgroundColor: alpha(BRAND_SURFACE, 0.86),
          '&:hover': {
            borderWidth: 1,
            borderColor: alpha(BRAND_BLUE, 0.28),
            backgroundColor: alpha(BRAND_BLUE, 0.04),
          },
        },
        text: {
          color: BRAND_BLUE_DARK,
          '&:hover': {
            backgroundColor: alpha(BRAND_BLUE, 0.06),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 800,
          letterSpacing: '0.03em',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: alpha(BRAND_SURFACE_ALT, 0.96),
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
          '& fieldset': {
            borderColor: alpha(BRAND_INK, 0.1),
          },
          '&:hover fieldset': {
            borderColor: alpha(BRAND_BLUE, 0.26),
          },
          '&.Mui-focused': {
            backgroundColor: BRAND_SURFACE,
            boxShadow: `0 0 0 3px ${alpha(BRAND_BLUE, 0.1)}`,
          },
          '&.Mui-focused fieldset': {
            borderColor: BRAND_BLUE,
          },
        },
        input: {
          paddingTop: 13,
          paddingBottom: 13,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: BRAND_MUTED,
          fontWeight: 600,
          '&.Mui-focused': {
            color: BRAND_BLUE,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(BRAND_SURFACE, 0.96),
          color: BRAND_INK,
          border: `1px solid ${alpha(BRAND_INK, 0.06)}`,
          backdropFilter: 'blur(16px)',
          boxShadow: '0 12px 32px rgba(20, 20, 20, 0.06)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha(BRAND_INK, 0.08),
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#F1F2F0',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: BRAND_INK,
          fontWeight: 800,
          fontSize: '0.78rem',
          textTransform: 'none',
          letterSpacing: 0,
          borderBottom: `1px solid ${alpha(BRAND_INK, 0.08)}`,
        },
        body: {
          color: BRAND_SLATE,
          borderBottom: `1px solid ${alpha(BRAND_INK, 0.06)}`,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: alpha(BRAND_BLUE, 0.035),
          },
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: {
          paddingInline: 8,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 0,
          background: BRAND_BLUE,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          minHeight: 46,
          fontWeight: 800,
          color: BRAND_MUTED,
          '&.Mui-selected': {
            color: BRAND_BLUE_DARK,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 4,
          border: `1px solid ${alpha(BRAND_INK, 0.08)}`,
          boxShadow: '0 28px 70px rgba(20, 20, 20, 0.14)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 4,
          border: `1px solid ${alpha(BRAND_INK, 0.08)}`,
          boxShadow: '0 24px 50px rgba(20, 20, 20, 0.12)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
  },
})

export default theme
