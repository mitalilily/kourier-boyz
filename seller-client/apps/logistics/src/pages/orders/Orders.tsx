import { Alert, Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AllOrders from '../../components/orders/AllOrders'
import { useMerchantReadiness } from '../../hooks/useMerchantReadiness'

export default function Orders() {
  const navigate = useNavigate()
  const { isReady, progress, firstIncompleteStep } = useMerchantReadiness()

  return (
    <Box sx={{ py: { xs: 2.2, md: 1 } }}>
      {!isReady && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate(firstIncompleteStep?.path || '/home')}
            >
              Continue Setup
            </Button>
          }
          sx={{ mb: 3 }}
        >
          <Typography sx={{ fontWeight: 700 }}>Order creation is locked</Typography>
          <Typography variant="body2">
            Complete merchant readiness first. Current progress: {progress}%.
          </Typography>
        </Alert>
      )}

      <AllOrders />
    </Box>
  )
}
