import { Alert, Box, Grid, Paper, Stack, Typography, alpha } from '@mui/material'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { FaWeightHanging } from 'react-icons/fa'
import { B2C_MIN_CHARGEABLE_WEIGHT_KG } from '../../../utils/constants'
import CustomInput from '../../UI/inputs/CustomInput'
import type { B2CFormData } from './B2COrderForm'

const ACCENT = '#B78115'
const TEXT_PRIMARY = '#17171A'
const TEXT_MUTED = '#496189'

const formatWeightDisplay = (kg: number) => {
  if (!Number.isFinite(kg) || kg <= 0) return '-'
  return `${kg.toFixed(2)} kg`
}

const PackageDimensionsForm = () => {
  const { control } = useFormContext<B2CFormData>()

  const weight = useWatch({ control, name: 'weight' }) || 0
  const length = useWatch({ control, name: 'length' }) || 0
  const breadth = useWatch({ control, name: 'breadth' }) || 0
  const height = useWatch({ control, name: 'height' }) || 0

  const actualWeightKg = Number(weight) || 0
  const volumetricWeightKg = (Number(length) * Number(breadth) * Number(height)) / 5000
  const chargedWeightKg = Math.max(
    actualWeightKg,
    volumetricWeightKg,
    B2C_MIN_CHARGEABLE_WEIGHT_KG,
  )

  const fields = ['weight', 'length', 'breadth', 'height'] as const

  return (
    <>
      <Alert
        severity="info"
        sx={{
          mb: 0.55,
          py: 0,
          px: 1,
          fontSize: '0.78rem',
          backgroundColor: alpha(ACCENT, 0.05),
          border: `1px solid ${alpha(ACCENT, 0.16)}`,
          color: TEXT_PRIMARY,
          borderRadius: 2,
          '& .MuiAlert-icon': {
            color: ACCENT,
          },
        }}
      >
        Note: The minimum chargeable weight is {B2C_MIN_CHARGEABLE_WEIGHT_KG.toFixed(2)} kg
      </Alert>

      <Grid container spacing={0.9}>
        {fields.map((key) => (
          <Grid size={{ xs: 12, md: 3 }} key={key}>
            <Controller
              name={key}
              control={control}
              defaultValue={0}
              rules={{
                required: `${key.charAt(0).toUpperCase() + key.slice(1)} is required`,
                min: { value: 0.01, message: 'Cannot be zero or negative' },
              }}
              render={({ field, fieldState }) => (
                <CustomInput
                  label={
                    key.charAt(0).toUpperCase() +
                    key.slice(1) +
                    (key === 'weight' ? ' (kg)' : ' (cm)')
                  }
                  type="number"
                  required
                  {...field}
                  value={field.value === 0 ? '' : field.value}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  topMargin={false}
                  dense
                />
              )}
            />
          </Grid>
        ))}
      </Grid>

      <Paper
        elevation={0}
        sx={{
          p: 1,
          mt: 0.65,
          borderRadius: 2,
          border: `1px solid ${alpha(ACCENT, 0.14)}`,
          background: '#FFFFFF',
        }}
      >
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, color: TEXT_PRIMARY }}
        >
          <FaWeightHanging size={14} color={ACCENT} />
          Package Weight Summary
        </Typography>
        <Typography variant="caption" sx={{ color: TEXT_MUTED, mb: 0.55, display: 'block', fontSize: '0.68rem' }}>
          {`Chargeable weight is calculated as max of actual, volumetric, or minimum weight (${B2C_MIN_CHARGEABLE_WEIGHT_KG.toFixed(2)} kg)`}
        </Typography>

        <Grid container spacing={0.65}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              elevation={0}
              sx={{
                p: 0.65,
                borderRadius: 2,
                border: `1px solid ${alpha(ACCENT, 0.12)}`,
                background: alpha(ACCENT, 0.03),
              }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ color: TEXT_MUTED }}>
                ACTUAL WEIGHT
              </Typography>
              <Typography variant="body2" fontWeight={800} sx={{ color: TEXT_PRIMARY, mt: 0.2 }}>
                {formatWeightDisplay(actualWeightKg)}
              </Typography>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              elevation={0}
              sx={{
                p: 0.65,
                borderRadius: 2,
                border: `1px solid ${alpha(ACCENT, 0.12)}`,
                background: '#FFFFFF',
              }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ color: TEXT_MUTED }}>
                VOLUMETRIC WEIGHT
              </Typography>
              <Typography variant="body2" fontWeight={800} sx={{ color: TEXT_PRIMARY, mt: 0.2 }}>
                {formatWeightDisplay(volumetricWeightKg)}
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_MUTED }}>
                L×B×H ÷ 5000
              </Typography>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              elevation={0}
              sx={{
                p: 0.65,
                borderRadius: 2,
                border: `2px solid ${alpha(ACCENT, 0.4)}`,
                background: alpha(ACCENT, 0.05),
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" fontWeight={700} sx={{ color: ACCENT }}>
                  CHARGEABLE WEIGHT
                </Typography>
                <Box
                  sx={{
                    px: 0.65,
                    py: 0.15,
                    borderRadius: 1,
                    bgcolor: alpha(ACCENT, 0.12),
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ color: ACCENT }}>
                    {chargedWeightKg === B2C_MIN_CHARGEABLE_WEIGHT_KG
                      ? 'MIN'
                      : chargedWeightKg === actualWeightKg
                      ? 'ACTUAL'
                      : 'VOLUMETRIC'}
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" fontWeight={800} sx={{ color: TEXT_PRIMARY, mt: 0.2 }}>
                {formatWeightDisplay(chargedWeightKg)}
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_MUTED }}>
                {chargedWeightKg === B2C_MIN_CHARGEABLE_WEIGHT_KG
                  ? 'Minimum weight applied'
                  : chargedWeightKg === actualWeightKg
                  ? 'Based on actual weight'
                  : 'Based on dimensions'}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </>
  )
}

export default PackageDimensionsForm
