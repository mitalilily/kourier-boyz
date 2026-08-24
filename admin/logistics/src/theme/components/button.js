export const buttonStyles = {
  components: {
    Button: {
      variants: {
        'no-hover': {
          _hover: {
            boxShadow: 'none',
          },
        },
        'transparent-with-icon': {
          bg: 'transparent',
          fontWeight: '700',
          borderRadius: '6px',
          cursor: 'pointer',
          _active: {
            bg: 'transparent',
            transform: 'none',
            borderColor: 'transparent',
          },
          _focus: {
            boxShadow: 'none',
          },
          _hover: {
            bg: 'rgba(75, 17, 150, 0.07)',
          },
        },
      },
      baseStyle: {
        borderRadius: '6px',
        fontWeight: '700',
        letterSpacing: '0',
        _focus: {
          boxShadow: 'none',
        },
      },
    },
  },
}
