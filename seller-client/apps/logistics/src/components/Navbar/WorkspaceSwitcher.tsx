import { Box, Button, Tooltip } from '@mui/material'
import { useState } from 'react'
import { FiShoppingBag, FiTruck } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { selectMerchantWorkspace } from '../../api/merchantCapabilities'

export default function WorkspaceSwitcher() {
  const navigate = useNavigate()
  const [opening, setOpening] = useState(false)

  const openMarketplace = async () => {
    setOpening(true)
    try {
      const capabilities = await selectMerchantWorkspace('marketplace')
      if (!capabilities.onboardingComplete) {
        navigate('/onboarding-questions?intent=marketplace')
      } else if (!capabilities.approved) {
        navigate('/profile/kyc_details?intent=marketplace')
      } else {
        window.location.assign('/store/')
      }
    } finally {
      setOpening(false)
    }
  }

  return (
    <Box sx={{ display: { xs: 'none', lg: 'flex' }, p: '3px', border: '1px solid rgba(32,35,33,.12)', bgcolor: 'rgba(246,247,244,.8)' }}>
      <Tooltip title="Courier shipping workspace">
        <Button startIcon={<FiTruck />} size="small" sx={{ minHeight: 30, px: 1.25, borderRadius: 0, bgcolor: '#252926', color: '#fff', fontWeight: 900, fontSize: 11, '&:hover': { bgcolor: '#111' } }}>Shipping</Button>
      </Tooltip>
      <Tooltip title="Marketplace seller workspace">
        <Button startIcon={<FiShoppingBag />} size="small" disabled={opening} onClick={() => void openMarketplace()} sx={{ minHeight: 30, px: 1.25, borderRadius: 0, color: '#72510c', fontWeight: 900, fontSize: 11, '&:hover': { bgcolor: 'rgba(183,129,21,.1)' } }}>Marketplace</Button>
      </Tooltip>
    </Box>
  )
}
