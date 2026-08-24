// src/components/CourierSummaryCard.tsx
import { alpha, Box, Card, CardContent, Grid, Typography } from '@mui/material'
import {
  FaExclamationTriangle,
  FaMapMarkedAlt,
  FaShippingFast,
  FaStore,
  FaUndoAlt,
} from 'react-icons/fa'
import type { CourierSummary } from '../../../api/courier'

interface Props {
  summary: CourierSummary
}

const summaryItems = (summary: CourierSummary) => [
  {
    label: 'Total Couriers',
    value: summary.totalCourierCount,
    icon: <FaShippingFast size={24} color="#B78115" />,
  },
  {
    label: 'Serviceable Pincodes',
    value: summary.serviceablePincodesCount,
    icon: <FaMapMarkedAlt size={24} color="#111113" />,
  },
  {
    label: 'Pickup Pincodes',
    value: summary.pickupPincodesCount,
    icon: <FaStore size={24} color="#B78115" />,
  },
  {
    label: 'Total RTO Count',
    value: summary.totalRtoCount,
    icon: <FaUndoAlt size={24} color="#111113" />,
  },
  {
    label: 'Total ODA Count',
    value: summary.totalOdaCount,
    icon: <FaExclamationTriangle size={24} color="#B78115" />,
  },
]

export default function CourierSummaryCard({ summary }: Props) {
  return (
    <Grid container spacing={2}>
      {summaryItems(summary).map(({ label, value, icon }) => (
        <Grid
          key={label}
          size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}
          sx={{
            flex: '1 1 auto',
            display: 'flex',
          }}
        >
          <Card
            variant="outlined"
            sx={{
              width: '100%',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F8F8F6 100%)',
              borderRadius: 3,
              borderColor: alpha('#111113', 0.08),
              height: '100%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <CardContent
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2.1,
                py: 1.9,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha('#B78115', 0.08),
                  border: `1px solid ${alpha('#B78115', 0.12)}`,
                }}
              >
                {icon}
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {label}
                </Typography>
                <Typography variant="h6" fontWeight={800}>
                  {value}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
