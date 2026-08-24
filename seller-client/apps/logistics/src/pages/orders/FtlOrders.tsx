import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { FiRefreshCw, FiSend } from 'react-icons/fi'
import { createFtlRequest, fetchMyFtlRequests, type FtlRequest, type FtlRequestPayload } from '../../api/ftl.api'
import { toast } from '../../components/UI/Toast'
import ListPageLayout from '../../components/UI/layout/ListPageLayout'
import ManualRequestDetailsDialog from '../../components/orders/ManualRequestDetailsDialog'

const initialForm: FtlRequestPayload = {
  firstName: '',
  lastName: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  companyName: '',
  originAddressLine1: '',
  originAddressLine2: '',
  originCity: '',
  originState: '',
  originPincode: '',
  originCountry: 'India',
  originAddress: '',
  destinationAddressLine1: '',
  destinationAddressLine2: '',
  destinationCity: '',
  destinationState: '',
  destinationPincode: '',
  destinationCountry: 'India',
  destinationAddress: '',
  vehicleType: '',
  materialType: '',
  weightKg: '',
  loadingDate: '',
}

const truckTypes = ['Flatbed', 'Refrigerated', 'Dry Van', 'Box Truck', 'Other']

const statusLabels: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  requested: { label: 'Requested', color: 'warning' },
  reviewing: { label: 'Reviewing', color: 'info' },
  quote_shared: { label: 'Quote Shared', color: 'primary' },
  processed: { label: 'Processed', color: 'primary' },
  in_transit: { label: 'In Transit', color: 'info' },
  delivered: { label: 'Delivered', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'error' },
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN')
}

export default function FtlOrders() {
  const [form, setForm] = useState(initialForm)
  const [requests, setRequests] = useState<FtlRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<FtlRequest | null>(null)

  const loadRequests = async () => {
    setLoading(true)
    try {
      const data = await fetchMyFtlRequests({ page: 1, limit: 25 })
      setRequests(data.requests || [])
    } catch (error: any) {
      toast.open({ message: error?.response?.data?.message || 'Failed to load FTL requests', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const handleChange = (field: keyof FtlRequestPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const customerName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim()
      const originAddress = [form.originAddressLine1, form.originAddressLine2].filter(Boolean).join(', ')
      const destinationAddress = [form.destinationAddressLine1, form.destinationAddressLine2]
        .filter(Boolean)
        .join(', ')
      await createFtlRequest({
        ...form,
        customerName,
        originAddress,
        destinationAddress,
      })
      toast.open({ message: 'FTL request sent to admin team', severity: 'success' })
      setForm(initialForm)
      await loadRequests()
    } catch (error: any) {
      toast.open({ message: error?.response?.data?.message || 'Failed to submit FTL request', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedRequestSections = selectedRequest
    ? [
        {
          title: 'Request',
          fields: [
            { label: 'Request ID', value: selectedRequest.requestNumber },
            { label: 'Status', value: selectedRequest.status?.replace(/_/g, ' ') },
            { label: 'AWB', value: selectedRequest.awbNumber },
            { label: 'Created', value: formatDate(selectedRequest.createdAt) },
            { label: 'Processed', value: formatDate(selectedRequest.processedDate) },
            { label: 'Updated', value: formatDate(selectedRequest.updatedAt) },
          ],
        },
        {
          title: 'Customer',
          fields: [
            { label: 'Name', value: selectedRequest.customerName },
            { label: 'Phone', value: selectedRequest.customerPhone },
            { label: 'Email', value: selectedRequest.customerEmail },
            { label: 'Company', value: selectedRequest.companyName },
          ],
        },
        {
          title: 'Pickup',
          fields: [
            { label: 'Address', value: selectedRequest.originAddress },
            { label: 'City', value: selectedRequest.originCity },
            { label: 'State', value: selectedRequest.originState },
            { label: 'Pincode', value: selectedRequest.originPincode },
            { label: 'Country', value: selectedRequest.originCountry },
          ],
        },
        {
          title: 'Delivery',
          fields: [
            { label: 'Address', value: selectedRequest.destinationAddress },
            { label: 'City', value: selectedRequest.destinationCity },
            { label: 'State', value: selectedRequest.destinationState },
            { label: 'Pincode', value: selectedRequest.destinationPincode },
            { label: 'Country', value: selectedRequest.destinationCountry },
          ],
        },
        {
          title: 'Cargo',
          fields: [
            { label: 'Vehicle Type', value: selectedRequest.vehicleType },
            { label: 'Material Type', value: selectedRequest.materialType },
            { label: 'Weight', value: selectedRequest.weightKg ? `${selectedRequest.weightKg} kg` : null },
            { label: 'Truck Count', value: selectedRequest.truckCount },
            { label: 'Preferred Pickup Date', value: formatDate(selectedRequest.loadingDate) },
            { label: 'Notes', value: selectedRequest.notes },
          ],
        },
        {
          title: 'Processing',
          fields: [
            { label: 'Admin Notes', value: selectedRequest.adminNotes },
          ],
        },
        {
          title: 'Captured Form Data',
          raw: (selectedRequest as any).formData,
        },
      ]
    : []

  return (
    <ListPageLayout
      title="Full Truck Load (FTL)"
      description="Submit manual FTL movement details and track the AWB/status once the admin team processes it."
      actions={[
        {
          label: loading ? 'Refreshing...' : 'Refresh',
          onClick: loadRequests,
          icon: <FiRefreshCw />,
          variant: 'outlined',
        },
      ]}
    >
      <Stack spacing={2}>
        <Alert severity="info">
          FTL bookings are handled manually. Submit these details and the admin team will process
          the booking, then update AWB/status/date in your table below.
        </Alert>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              FTL request details
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Full Name *</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                    <TextField fullWidth required size="small" label="First Name" value={form.firstName} onChange={handleChange('firstName')} />
                    <TextField fullWidth required size="small" label="Last Name" value={form.lastName} onChange={handleChange('lastName')} />
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                  <TextField fullWidth required size="small" label="Company Name" value={form.companyName} onChange={handleChange('companyName')} />
                  <TextField fullWidth required size="small" type="email" label="Email Address" value={form.customerEmail} onChange={handleChange('customerEmail')} />
                  <TextField fullWidth required size="small" label="Phone Number" value={form.customerPhone} onChange={handleChange('customerPhone')} helperText="Please enter a valid phone number." />
                </Box>

                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Pickup Address *</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                    <TextField fullWidth required size="small" label="Street Address" value={form.originAddressLine1} onChange={handleChange('originAddressLine1')} />
                    <TextField fullWidth size="small" label="Street Address Line 2" value={form.originAddressLine2} onChange={handleChange('originAddressLine2')} />
                    <TextField fullWidth required size="small" label="City" value={form.originCity} onChange={handleChange('originCity')} />
                    <TextField fullWidth required size="small" label="State / Province" value={form.originState} onChange={handleChange('originState')} />
                    <TextField fullWidth required size="small" label="Postal / Zip Code" value={form.originPincode} onChange={handleChange('originPincode')} />
                    <TextField fullWidth required size="small" label="Country" value={form.originCountry} onChange={handleChange('originCountry')} />
                  </Box>
                </Box>

                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Delivery Address *</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                    <TextField fullWidth required size="small" label="Street Address" value={form.destinationAddressLine1} onChange={handleChange('destinationAddressLine1')} />
                    <TextField fullWidth size="small" label="Street Address Line 2" value={form.destinationAddressLine2} onChange={handleChange('destinationAddressLine2')} />
                    <TextField fullWidth required size="small" label="City" value={form.destinationCity} onChange={handleChange('destinationCity')} />
                    <TextField fullWidth required size="small" label="State / Province" value={form.destinationState} onChange={handleChange('destinationState')} />
                    <TextField fullWidth required size="small" label="Postal / Zip Code" value={form.destinationPincode} onChange={handleChange('destinationPincode')} />
                    <TextField fullWidth required size="small" label="Country" value={form.destinationCountry} onChange={handleChange('destinationCountry')} />
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  <TextField fullWidth required size="small" type="date" label="Preferred Pickup Date" InputLabelProps={{ shrink: true }} value={form.loadingDate} onChange={handleChange('loadingDate')} />
                  <TextField fullWidth required size="small" label="Cargo Description (type of goods)" value={form.materialType} onChange={handleChange('materialType')} />
                  <TextField fullWidth required size="small" type="number" label="Estimated Total Weight (kg)" value={form.weightKg} onChange={handleChange('weightKg')} inputProps={{ min: 1, max: 50000, step: 'any' }} />
                  <TextField fullWidth required select size="small" label="Preferred Truck Type" value={form.vehicleType} onChange={handleChange('vehicleType')}>
                    {truckTypes.map((truckType) => (
                      <MenuItem key={truckType} value={truckType}>
                        {truckType}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Stack>
              <Button type="submit" variant="contained" startIcon={<FiSend />} disabled={submitting} sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }}>
                {submitting ? 'Submitting...' : 'Send FTL Request'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              My FTL requests
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Request</TableCell>
                    <TableCell>Route</TableCell>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>AWB</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Processed Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.length ? requests.map((request) => {
                    const status = statusLabels[request.status] || { label: request.status, color: 'default' as const }
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => setSelectedRequest(request)}
                            sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 800 }}
                          >
                            {request.requestNumber}
                          </Button>
                        </TableCell>
                        <TableCell>{request.originCity} → {request.destinationCity}</TableCell>
                        <TableCell>{request.vehicleType}</TableCell>
                        <TableCell>{request.awbNumber || '—'}</TableCell>
                        <TableCell><Chip size="small" label={status.label} color={status.color} /></TableCell>
                        <TableCell>{formatDate(request.processedDate)}</TableCell>
                      </TableRow>
                    )
                  }) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">{loading ? 'Loading...' : 'No FTL requests yet'}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

      </Stack>
      <ManualRequestDetailsDialog
        open={Boolean(selectedRequest)}
        title={selectedRequest?.requestNumber || 'FTL request'}
        subtitle="Full truck load request details"
        sections={selectedRequestSections}
        onClose={() => setSelectedRequest(null)}
      />
    </ListPageLayout>
  )
}
