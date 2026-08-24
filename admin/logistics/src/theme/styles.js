import { mode } from '@chakra-ui/theme-tools'
import colors from './foundations/colors'

export const globalStyles = {
  colors: {
    ...colors,
  },
  styles: {
    global: (props) => ({
      body: {
        bg: mode('#F1F2F0', '#202321')(props),
        color: mode('gray.800', 'gray.100')(props),
        fontFamily: "'Open Sans', 'Segoe UI', sans-serif",
        backgroundImage: 'none',
      },
      html: {
        fontFamily: "'Open Sans', 'Segoe UI', sans-serif",
      },
      '#root': {
        minHeight: '100vh',
      },
      'a': { color: 'inherit' },
      '::selection': {
        background: mode('brand.200', 'brand.600')(props),
      },
    }),
  },
}
