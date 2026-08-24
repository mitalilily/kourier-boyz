const Card = {
  baseStyle: {
    p: '22px',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    position: 'relative',
    minWidth: '0px',
    wordWrap: 'break-word',
    backgroundClip: 'border-box',
  },
  variants: {
    panel: (props) => ({
      bg: props.colorMode === 'dark' ? '#252927' : 'white',
      width: '100%',
      border: props.colorMode === 'dark' ? '1px solid rgba(151, 141, 170, 0.18)' : '1px solid rgba(46, 41, 56, 0.08)',
      boxShadow:
        props.colorMode === 'dark'
          ? '0 18px 40px rgba(5, 4, 10, 0.35)'
          : '0 16px 36px rgba(29, 21, 46, 0.06)',
      borderRadius: '6px',
      overflow: 'hidden',
    }),
  },
  defaultProps: {
    variant: 'panel',
  },
}

export const CardComponent = {
  components: {
    Card,
  },
}
