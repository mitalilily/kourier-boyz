import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormGroup,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { downloadCustomReportCsv } from '../../api/reports.api'
import { toast } from '../../components/UI/Toast'

type ReportField = {
  key: string
  label: string
}

type FieldGroup = {
  key: 'orders' | 'shipment' | 'ndr'
  label: string
  fields: ReportField[]
}

const GROUPS: FieldGroup[] = [
  {
    key: 'orders',
    label: 'Orders',
    fields: [
      { key: 'order_number', label: 'order_number' },
      { key: 'order_date', label: 'order_date' },
      { key: 'order_amount', label: 'order_amount' },
      { key: 'order_type', label: 'order_type' },
      { key: 'buyer_name', label: 'buyer_name' },
      { key: 'buyer_phone', label: 'buyer_phone' },
      { key: 'buyer_email', label: 'buyer_email' },
      { key: 'address', label: 'address' },
      { key: 'city', label: 'city' },
      { key: 'state', label: 'state' },
      { key: 'pincode', label: 'pincode' },
      { key: 'weight', label: 'weight' },
      { key: 'length', label: 'length' },
      { key: 'height', label: 'height' },
      { key: 'breadth', label: 'breadth' },
      { key: 'order_status', label: 'order_status' },
      { key: 'freight_charges', label: 'freight_charges' },
      { key: 'discount', label: 'discount' },
      { key: 'products', label: 'products' },
    ],
  },
  {
    key: 'shipment',
    label: 'Shipment',
    fields: [
      { key: 'shipment_date', label: 'shipment_date' },
      { key: 'awb_number', label: 'awb_number' },
      { key: 'shipment_status', label: 'shipment_status' },
      { key: 'remittance_id', label: 'remittance_id' },
      { key: 'pickup_time', label: 'pickup_time' },
      { key: 'delivered_time', label: 'delivered_time' },
      { key: 'charged_weight', label: 'charged_weight' },
      { key: 'zone', label: 'zone' },
      { key: 'last_status_updated', label: 'last_status_updated' },
    ],
  },
  {
    key: 'ndr',
    label: 'NDR',
    fields: [{ key: 'ndr_attempts_info', label: 'ndr_attempts_info' }],
  },
]

const ALL_FIELD_KEYS = GROUPS.flatMap((group) => group.fields.map((field) => field.key))

const formatUiDate = (value: string) => {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

const getToday = () => new Date().toISOString().slice(0, 10)
const getMonthStart = () => {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

export default function Reports() {
  const BRAND_PRIMARY = '#B78115'
  const BRAND_TEXT = '#17171A'
  const BRAND_MUTED = '#626966'
  const [fromDate, setFromDate] = useState<string>(getMonthStart())
  const [toDate, setToDate] = useState<string>(getToday())
  const [selectedFields, setSelectedFields] = useState<string[]>(ALL_FIELD_KEYS)
  const [downloading, setDownloading] = useState(false)

  const allSelected = selectedFields.length === ALL_FIELD_KEYS.length

  const selectedByGroup = useMemo(() => {
    const selectedSet = new Set(selectedFields)
    return GROUPS.reduce<Record<string, number>>((acc, group) => {
      acc[group.key] = group.fields.filter((field) => selectedSet.has(field.key)).length
      return acc
    }, {})
  }, [selectedFields])

  const toggleField = (key: string) => {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((field) => field !== key) : [...prev, key]))
  }

  const toggleSelectAll = () => {
    setSelectedFields((prev) => (prev.length === ALL_FIELD_KEYS.length ? [] : ALL_FIELD_KEYS))
  }

  const onDownload = async () => {
    if (!fromDate || !toDate) {
      toast.open({ message: 'Please select date range', severity: 'warning' })
      return
    }
    if (selectedFields.length === 0) {
      toast.open({ message: 'Please select at least one field', severity: 'warning' })
      return
    }

    setDownloading(true)
    try {
      const blob = await downloadCustomReportCsv({ fromDate, toDate, selectedFields })
      const fileName = `custom_report_${fromDate}_to_${toDate}.csv`
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      window.URL.revokeObjectURL(url)
      toast.open({ message: 'Report downloaded', severity: 'success' })
    } catch (error: any) {
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result || '')
        try {
          const parsed = JSON.parse(text)
          toast.open({
            message: parsed?.message || 'Failed to download report',
            severity: 'error',
          })
        } catch {
          toast.open({ message: 'Failed to download report', severity: 'error' })
        }
      }
      if (error?.response?.data instanceof Blob) {
        reader.readAsText(error.response.data)
      } else {
        toast.open({ message: 'Failed to download report', severity: 'error' })
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Stack spacing={2.5} sx={{ py: 2.5 }}>
      <Box
        sx={{
          p: { xs: 2.1, md: 2.8 },
          borderRadius: 5,
          border: '1px solid rgba(17, 17, 19, 0.08)',
          background:
            'radial-gradient(circle at top right, rgba(49, 2, 118,0.14) 0%, transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,244,241,0.98) 100%)',
          boxShadow: '0 18px 38px rgba(17, 17, 19, 0.06)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
          <Box>
            <Typography sx={{ fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 800, color: BRAND_TEXT }}>
              Custom reports
            </Typography>
            <Typography sx={{ fontSize: '0.92rem', color: BRAND_MUTED, mt: 0.7, maxWidth: 760 }}>
              Build exports for orders, shipments, and NDR data with only the columns your team needs.
            </Typography>
          </Box>
          <Box
            sx={{
              alignSelf: 'flex-start',
              px: 1.1,
              py: 0.55,
              borderRadius: 999,
              bgcolor: alpha(BRAND_PRIMARY, 0.08),
              color: BRAND_PRIMARY,
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Export builder
          </Box>
        </Stack>
      </Box>

      <Card
        variant="outlined"
        sx={{
          borderRadius: 5,
          borderColor: alpha('#111113', 0.08),
          boxShadow: '0 18px 34px rgba(17, 17, 19, 0.06)',
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 2.6 } }}>
          <Stack spacing={2.4}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              gap={2}
            >
              <Typography fontWeight={800} color={BRAND_TEXT}>
                Date Range
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                <TextField type="date" size="small" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <TextField type="date" size="small" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Stack>
              <Typography color="text.secondary">
                {formatUiDate(fromDate)} - {formatUiDate(toDate)}
              </Typography>
            </Stack>

            <Divider />

            <FormControlLabel
              control={<Checkbox checked={allSelected} onChange={toggleSelectAll} />}
              label="Select All Fields"
            />

            <Grid container spacing={2}>
              {GROUPS.map((group) => (
                <Grid key={group.key} size={{ xs: 12, md: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 4,
                      height: '100%',
                      borderColor: alpha('#111113', 0.08),
                      boxShadow: '0 12px 28px rgba(17, 17, 19, 0.05)',
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" fontWeight={800} gutterBottom color={BRAND_TEXT}>
                        {group.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
                        {selectedByGroup[group.key] || 0} selected
                      </Typography>
                      <FormGroup>
                        {group.fields.map((field) => (
                          <FormControlLabel
                            key={field.key}
                            control={
                              <Checkbox
                                checked={selectedFields.includes(field.key)}
                                onChange={() => toggleField(field.key)}
                              />
                            }
                            label={field.label}
                          />
                        ))}
                      </FormGroup>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Box>
              <Button
                variant="contained"
                onClick={onDownload}
                disabled={downloading}
                startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ borderRadius: 999 }}
              >
                {downloading ? 'Generating CSV...' : 'Download CSV'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
