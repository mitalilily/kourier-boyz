import { extendTheme } from '@chakra-ui/react'
import { CardComponent } from './additions/card/Card'
import { CardBodyComponent } from './additions/card/CardBody'
import { CardHeaderComponent } from './additions/card/CardHeader'
import { MainPanelComponent } from './additions/layout/MainPanel'
import { PanelContainerComponent } from './additions/layout/PanelContainer'
import { PanelContentComponent } from './additions/layout/PanelContent'
import { badgeStyles } from './components/badge'
import { buttonStyles } from './components/button'
import { drawerStyles } from './components/drawer'
import { linkStyles } from './components/link'
import { breakpoints } from './foundations/breakpoints'
import { globalStyles } from './styles'

const dividerStyles = {
  components: {
    Divider: {
      baseStyle: {
        borderColor: 'gray.200',
        borderWidth: '1px',
      },
      variants: {
        subtle: {
          borderColor: 'gray.200',
        },
        solid: {
          borderColor: 'gray.600',
        },
      },
      defaultProps: {
        variant: 'subtle',
      },
    },
  },
}

const componentOverrides = {
  components: {
    Input: {
      baseStyle: { field: { borderRadius: '6px' } },
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
    Select: {
      baseStyle: { field: { borderRadius: '6px' } },
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
    Textarea: {
      baseStyle: { borderRadius: '6px' },
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            textTransform: 'none',
            letterSpacing: '0',
            fontWeight: '700',
            fontSize: '12px',
            color: 'gray.600',
            borderColor: 'gray.200',
            bg: 'gray.50',
          },
          td: {
            borderColor: 'gray.100',
            fontSize: '14px',
            color: 'gray.700',
          },
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          borderRadius: '8px',
          borderWidth: '1px',
          borderColor: 'gray.200',
          boxShadow: '0 24px 52px rgba(17, 17, 19, 0.18)',
          overflow: 'hidden',
        },
        header: {
          fontWeight: '700',
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: '4px',
        textTransform: 'none',
        px: '2.5',
        py: '1',
        fontWeight: '700',
      },
    },
    Tooltip: {
      baseStyle: {
        borderRadius: '8px',
      },
    },
  },
  fonts: {
    heading: "'Raleway', 'Open Sans', sans-serif",
    body: "'Open Sans', sans-serif",
  },
}

export default extendTheme(
  { breakpoints },
  globalStyles,
  buttonStyles,
  badgeStyles,
  linkStyles,
  drawerStyles,
  CardComponent,
  CardBodyComponent,
  CardHeaderComponent,
  MainPanelComponent,
  PanelContentComponent,
  PanelContainerComponent,
  dividerStyles,
  componentOverrides,
)
