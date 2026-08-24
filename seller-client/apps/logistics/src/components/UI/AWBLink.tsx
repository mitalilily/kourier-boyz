import { alpha, Link as MuiLink } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import {
  getAwbTrackingPath,
  getClientAwbTrackingPath,
  isValidAwb,
  normalizeAwb,
} from '../../utils/awb'

interface AWBLinkProps {
  awb?: string | null
  stopPropagation?: boolean
}

export default function AWBLink({ awb, stopPropagation = true }: AWBLinkProps) {
  const normalizedAwb = normalizeAwb(awb)
  const location = useLocation()

  if (!isValidAwb(normalizedAwb)) {
    return <>{normalizedAwb || '—'}</>
  }

  const trackingPath = location.pathname.startsWith('/tracking')
    ? getAwbTrackingPath(normalizedAwb)
    : getClientAwbTrackingPath(normalizedAwb)

  return (
    <MuiLink
      component={RouterLink}
      to={trackingPath}
      underline="hover"
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation()
        }
      }}
      sx={{
        color: '#B78115',
        cursor: 'pointer',
        fontWeight: 700,
        textDecorationColor: alpha('#B78115', 0.45),
        textUnderlineOffset: '0.14em',
        '&:hover': {
          color: '#A80311',
        },
      }}
    >
      {normalizedAwb}
    </MuiLink>
  )
}
