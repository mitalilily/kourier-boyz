import { Box, Card, CardContent, Grid, Stack, Typography, alpha, useTheme } from '@mui/material'
import { MdAnalytics, MdShoppingBag } from 'react-icons/md'
import { TbCurrencyRupee } from 'react-icons/tb'

interface MetricsOverviewCardProps {
  metrics: {
    avgOrderValue: number
    totalPrepaidOrders: number
    totalCodOrders: number
  }
  formatCurrency: (amount: number) => string
}

export default function MetricsOverviewCard({ metrics, formatCurrency }: MetricsOverviewCardProps) {
  const theme = useTheme()

  const metricCards = [
    {
      title: 'Avg Order Value',
      value: formatCurrency(metrics.avgOrderValue || 0),
      icon: <MdAnalytics size={24} />,
      color: theme.palette.primary.main,
      gradient: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
    },
    {
      title: 'Prepaid Orders',
      value: metrics.totalPrepaidOrders?.toLocaleString() || '0',
      icon: <MdShoppingBag size={24} />,
      color: theme.palette.info.main,
      gradient: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
    },
    {
      title: 'COD Orders',
      value: metrics.totalCodOrders?.toLocaleString() || '0',
      icon: <TbCurrencyRupee size={24} />,
      color: theme.palette.warning.main,
      gradient: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
    },
  ]

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 0,
        boxShadow: '0 6px 18px rgba(17,17,19,0.05)',
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)} 0%, transparent 100%)`
          : 'white',
      }}
    >
      <CardContent sx={{ p: 2.2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
          <Box
            sx={{
              bgcolor: alpha(theme.palette.secondary.main, 0.1),
              borderRadius: 0,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MdAnalytics size={24} color={theme.palette.secondary.main} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Key Metrics
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Business insights
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={2} mb={3}>
          {metricCards.map((metric, idx) => (
            <Grid size={{ xs: 12, sm: 4 }} key={idx}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 0,
                  background: metric.gradient,
                  border: `1.5px solid ${alpha(metric.color, 0.2)}`,
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: `0 6px 14px ${alpha(metric.color, 0.12)}`,
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                  <Box
                    sx={{
                      bgcolor: alpha(metric.color, 0.15),
                      borderRadius: 0,
                      p: 0.75,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: metric.color,
                    }}
                  >
                    {metric.icon}
                  </Box>
                  <Typography variant="body2" fontWeight="600" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {metric.title}
                  </Typography>
                </Stack>
                <Typography variant="h6" fontWeight="bold" color={metric.color} sx={{ mb: 0.5 }}>
                  {metric.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  )
}
