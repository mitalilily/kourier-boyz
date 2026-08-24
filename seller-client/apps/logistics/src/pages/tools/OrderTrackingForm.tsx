'use client'

import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  FaBoxOpen,
  FaEnvelopeOpenText,
  FaHashtag,
  FaPhoneAlt,
  FaReceipt,
  FaSearch,
} from 'react-icons/fa'
import { MdLocationOn, MdSchedule } from 'react-icons/md'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { TrackingHistory } from '../../api/tracking.service'
import AWBLink from '../../components/UI/AWBLink'
import CustomInput from '../../components/UI/inputs/CustomInput'
import { SmartTabs } from '../../components/UI/tab/Tabs'
import { useTracking } from '../../hooks/Orders/useTracking'
import {
  getAwbTrackingPath,
  getClientAwbTrackingPath,
  isValidAwb,
  normalizeAwb,
} from '../../utils/awb'

type FormValues = {
  awb: string
  orderNumber: string
  contact: string
}

const formatTrackingEventTime = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function OrderTrackingForm() {
  const BRAND_PRIMARY = '#B78115'
  const BRAND_ACCENT = '#555D61'
  const shellCardStyles = {
    borderRadius: 2.5,
    border: `1px solid ${alpha(BRAND_PRIMARY, 0.12)}`,
    boxShadow: '0 12px 26px rgba(20, 20, 20, 0.07)',
    background:
      'radial-gradient(circle at top right, rgba(232,85,0,0.09) 0%, transparent 24%), linear-gradient(180deg, #FFFFFF 0%, #FBF7F4 100%)',
  }

  const navigate = useNavigate()
  const location = useLocation()
  const { awb: awbParam } = useParams<{ awb?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<'awb' | 'order'>('awb')
  const [error, setError] = useState('')

  const routeAwb = normalizeAwb(awbParam)
  const queryAwb = normalizeAwb(searchParams.get('awb'))
  const activeAwb = routeAwb || queryAwb
  const activeOrder = searchParams.get('orderNumber')
  const activeContact = searchParams.get('contact')
  const isClientTrackingRoute = location.pathname.startsWith('/tools/order_tracking')
  const trackingBasePath = isClientTrackingRoute ? '/tools/order_tracking' : '/tracking'

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      awb: '',
      orderNumber: '',
      contact: '',
    },
  })

  const formValues = watch()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.contact)
  const isPhone = /^[0-9+\-\s()]{7,}$/.test(formValues.contact)
  const isContactValid = !formValues.contact || isEmail || isPhone

  const {
    data: tracking,
    isFetching: trackingLoading,
    isError: trackingError,
    error: trackingErrorObj,
    isSuccess,
  } = useTracking(
    isValidAwb(activeAwb) ? activeAwb : null,
    activeOrder ?? null,
    activeContact ?? null,
  )

  useEffect(() => {
    if (activeAwb) {
      setMode('awb')
      reset({
        awb: activeAwb,
        orderNumber: '',
        contact: '',
      })
      if (!isValidAwb(activeAwb)) {
        setError('Invalid AWB')
      }
      return
    }

    if (activeOrder || activeContact) {
      setMode('order')
      reset({
        awb: '',
        orderNumber: activeOrder || '',
        contact: activeContact || '',
      })
      return
    }

    reset({
      awb: '',
      orderNumber: '',
      contact: '',
    })
  }, [activeAwb, activeContact, activeOrder, reset])

  useEffect(() => {
    if (activeAwb && !isValidAwb(activeAwb)) {
      setError('Invalid AWB')
      return
    }

    if (trackingError) {
      setError(
        trackingErrorObj instanceof Error ? trackingErrorObj.message : 'Failed to fetch tracking',
      )
    } else if (isSuccess) {
      setError('')
    }
  }, [activeAwb, isSuccess, trackingError, trackingErrorObj])

  const canSubmit =
    mode === 'awb'
      ? isValidAwb(formValues.awb)
      : formValues.orderNumber.trim().length > 2 &&
        formValues.contact.trim().length > 3 &&
        isContactValid

  const onSubmit = (data: FormValues) => {
    if (!canSubmit) return
    setError('')

    if (mode === 'awb') {
      const normalizedAwb = normalizeAwb(data.awb)
      if (!isValidAwb(normalizedAwb)) {
        setError('Invalid AWB')
        return
      }
      navigate(
        isClientTrackingRoute
          ? getClientAwbTrackingPath(normalizedAwb)
          : getAwbTrackingPath(normalizedAwb),
      )
      return
    }

    const params = new URLSearchParams({
      orderNumber: data.orderNumber.trim(),
      contact: data.contact.trim(),
    })

    navigate(`${trackingBasePath}?${params.toString()}`)
  }

  const sortedHistory = useMemo<TrackingHistory[]>(() => {
    if (!tracking?.history) return []
    return [...tracking.history].sort(
      (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime(),
    )
  }, [tracking])

  const resetResults = () => {
    setError('')
    setSearchParams({})
  }

  return (
    <Stack sx={{ py: { xs: 1, md: 1.4 } }} spacing={{ xs: 1.25, md: 1.5 }}>
      <Box
        sx={{
          p: { xs: 1.6, md: 2 },
          borderRadius: 2.5,
          border: `1px solid ${alpha(BRAND_PRIMARY, 0.12)}`,
          boxShadow: '0 10px 24px rgba(20, 20, 20, 0.07)',
          background:
            'radial-gradient(circle at top right, rgba(26,117,0,0.08) 0%, transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,247,245,0.98) 100%)',
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: '1.2rem', md: '1.45rem' },
            fontWeight: 800,
            color: '#17171A',
            lineHeight: 1.12,
          }}
        >
          Shipment tracking
        </Typography>
        <Typography sx={{ mt: 0.5, maxWidth: 760, color: '#626966', fontSize: '0.88rem' }}>
          Track every Kourier Boyz shipment from a single clean workspace using either AWB details or
          your order reference with customer contact.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} mt={1.1}>
          {[
            'Live courier event timeline',
            'Search by AWB or order reference',
            'Clear shipment overview and delivery ETA',
          ].map((item) => (
            <Chip
              key={item}
              label={item}
              sx={{
                alignSelf: 'flex-start',
                bgcolor: alpha(BRAND_PRIMARY, 0.08),
                color: BRAND_PRIMARY,
                borderRadius: '999px',
                fontWeight: 700,
                height: 26,
                fontSize: '0.74rem',
              }}
            />
          ))}
        </Stack>
      </Box>

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        sx={{ p: { xs: 1.6, md: 2.2 }, ...shellCardStyles }}
      >
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#17171A', mb: 0.25 }}>
          Find a shipment
        </Typography>
        <Typography variant="body2" sx={{ color: '#626966', mb: 1.4, fontSize: '0.84rem' }}>
          Enter the strongest identifier you have and we&apos;ll pull the latest tracking activity.
        </Typography>

        <SmartTabs
          onChange={(value) => {
            const nextMode = value as 'awb' | 'order'
            setMode(nextMode)
            reset({
              awb: '',
              orderNumber: '',
              contact: '',
            })
            setError('')
            resetResults()
            if (nextMode === 'order' && location.pathname.startsWith('/tracking/')) {
              navigate(trackingBasePath)
            }
          }}
          tabs={[
            { label: 'Track By AWB', value: 'awb' },
            { label: 'Track By Order ID', value: 'order' },
          ]}
          value={mode}
        />

        {mode === 'awb' ? (
          <FormControl fullWidth sx={{ mb: 1.6 }}>
            <Controller
              name="awb"
              control={control}
              render={({ field }) => (
                <CustomInput
                  {...field}
                  id="awb"
                  placeholder="e.g. 1234567890"
                  prefix={<FaHashtag />}
                  error={!!errors.awb}
                  helperText={errors.awb?.message || 'Click any AWB in the app to jump here instantly'}
                  label="AWB Number"
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                />
              )}
              rules={{
                required: 'AWB number is required',
                validate: (value) => isValidAwb(value) || 'Invalid AWB',
              }}
            />
            {errors.awb && <FormHelperText error>{errors.awb.message}</FormHelperText>}
          </FormControl>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 1.6 }}>
              <Controller
                name="orderNumber"
                control={control}
                render={({ field }) => (
                  <CustomInput
                    {...field}
                    id="orderNumber"
                    placeholder="e.g. ORD-2025-0001"
                    prefix={<FaReceipt />}
                    error={!!errors.orderNumber}
                    label="Order ID"
                  />
                )}
                rules={{ required: 'Order ID is required' }}
              />
              {errors.orderNumber && (
                <FormHelperText error>{errors.orderNumber.message}</FormHelperText>
              )}
            </FormControl>

            <FormControl fullWidth sx={{ mb: 1.6 }}>
              <Controller
                name="contact"
                control={control}
                render={({ field }) => (
                  <CustomInput
                    {...field}
                    id="contact"
                    placeholder="you@example.com or +91 98765 43210"
                    prefix={isEmail ? <FaEnvelopeOpenText /> : <FaPhoneAlt />}
                    error={!isContactValid}
                    label="Email or Phone"
                  />
                )}
                rules={{ required: 'Email or Phone is required' }}
              />
              {!isContactValid && (
                <FormHelperText error>Enter a valid email or phone number</FormHelperText>
              )}
            </FormControl>
          </>
        )}

        {error && (
          <Typography
            variant="body2"
            mb={2}
            sx={{
              color: '#B42318',
              bgcolor: 'rgba(180,35,24,0.06)',
              border: '1px solid rgba(180,35,24,0.12)',
              borderRadius: 2,
              px: 1.6,
              py: 0.9,
            }}
          >
            {error}
          </Typography>
        )}

        <Box display="flex" gap={1.2} alignItems="center" flexWrap="wrap">
          <Button
            type="submit"
            variant="contained"
            startIcon={trackingLoading ? <CircularProgress size={18} /> : <FaSearch />}
            disabled={!canSubmit || trackingLoading}
            sx={{
              borderRadius: '8px',
              minHeight: 38,
              px: 2,
              py: 0.8,
              bgcolor: BRAND_PRIMARY,
              textTransform: 'none',
              fontWeight: 700,
              '&:hover': { bgcolor: '#591AA4' },
            }}
          >
            {trackingLoading ? 'Tracking...' : 'Track Order'}
          </Button>
          <Button
            type="button"
            variant="text"
            color="inherit"
            onClick={() => {
              reset({
                awb: '',
                orderNumber: '',
                contact: '',
              })
              resetResults()
              if (location.pathname.startsWith('/tracking')) {
                navigate(trackingBasePath)
              }
            }}
            sx={{
              borderRadius: '8px',
              color: '#626966',
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            Reset
          </Button>
        </Box>
      </Box>

      {isSuccess && tracking && (activeAwb || (activeOrder && activeContact)) && (
        <Stack spacing={1.5} mt={1.5}>
          <Card sx={shellCardStyles}>
            <CardContent>
              <Typography variant="h6" fontWeight={800} gutterBottom color="#17171A">
                Shipment Overview
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    AWB Number
                  </Typography>
                  <Typography fontWeight={600}>
                    {tracking.awb_number ? <AWBLink awb={tracking.awb_number} /> : '-'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Order Number
                  </Typography>
                  <Typography fontWeight={600}>{tracking.order_number || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Courier
                  </Typography>
                  <Typography fontWeight={600}>{tracking.courier_name || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={tracking.status || 'Unknown'}
                    color={(() => {
                      const normalized = (tracking.status || '').toLowerCase()
                      if (normalized.includes('deliver')) return 'success'
                      if (normalized.includes('transit')) return 'info'
                      if (normalized.includes('cancel')) return 'error'
                      if (normalized.includes('rto')) return 'warning'
                      return 'default'
                    })()}
                    size="small"
                    sx={{ fontWeight: 700, borderRadius: '999px' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Payment Type
                  </Typography>
                  <Typography fontWeight={600} textTransform="uppercase">
                    {tracking.payment_type || '-'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Estimated Delivery
                  </Typography>
                  <Typography fontWeight={600}>
                    {tracking.edd ? new Date(tracking.edd).toLocaleDateString() : '-'}
                  </Typography>
                </Grid>
              </Grid>
              {tracking.shipment_info && (
                <Box mt={3}>
                  <Typography variant="body2" color="text.secondary" gutterBottom fontWeight={700}>
                    Shipment Info
                  </Typography>
                  <Typography fontSize={14}>{tracking.shipment_info}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={shellCardStyles}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
                spacing={1}
                mb={1}
              >
                <Typography variant="h6" fontWeight={800} color="#17171A">
                  Tracking Timeline
                </Typography>
                <Chip
                  label={`${sortedHistory.length} event${sortedHistory.length === 1 ? '' : 's'}`}
                  sx={{
                    bgcolor: alpha(BRAND_ACCENT, 0.1),
                    color: BRAND_ACCENT,
                    borderRadius: '999px',
                    fontWeight: 800,
                  }}
                />
              </Stack>
              <Divider sx={{ mb: 1.5 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'none' }}>
                Tracking Timeline
              </Typography>
              {sortedHistory.length === 0 ? (
                <Typography color="text.secondary">No tracking events available yet.</Typography>
              ) : (
                <List>
                  {sortedHistory.map((event, idx) => (
                    <Fragment key={`${event.event_time}-${idx}`}>
                      <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {idx === 0 ? (
                            <FaBoxOpen color="#B78115" size={20} />
                          ) : (
                            <MdLocationOn color="#6B7280" size={20} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography fontWeight={600}>
                                {event.message || event.status_code}
                              </Typography>
                              <Chip
                                size="small"
                                label={event.status_code}
                                color={idx === 0 ? 'primary' : 'default'}
                                sx={{ borderRadius: '999px', fontWeight: 700 }}
                              />
                            </Stack>
                          }
                          secondary={
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              mt={0.5}
                              alignItems={{ sm: 'center' }}
                            >
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <MdSchedule size={16} />
                                <Typography variant="caption">
                                  {formatTrackingEventTime(event.event_time)}
                                </Typography>
                              </Stack>
                              {event.location && (
                                <Typography variant="caption" color="text.secondary">
                                  {event.location}
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                      {idx !== sortedHistory.length - 1 && <Divider component="li" />}
                    </Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  )
}
