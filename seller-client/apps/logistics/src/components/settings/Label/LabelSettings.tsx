import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useLabelPreferences } from '../../../hooks/useLabelPreferences'
import { mapApiToForm, mapFormToApi } from '../../../utils/labelPreferencesMapper'
import { glassStyles } from '../../UI/accordion/FormSectionAccordion'
import PageHeading from '../../UI/heading/PageHeading'
import { LabelPreview } from './LabelPreview'

export type LabelSettingsForm = {
  orderInfo: {
    alternatePhone: boolean
    billingGstin: boolean
    ewayBillNumber: boolean
  }
  shipperInfo: {
    brandLogo: boolean
    shipperName: boolean
    shipperAddress: boolean
    shipperPhone: boolean
    gstin: boolean
    returnName: boolean
    returnAddress: boolean
    returnPhone: boolean
  }
  productInfo: {
    productCost: boolean
  }
  charLimit: number
  maxItems: number
  printer: 'thermal' | 'inkjet'
}

const defaultValues: LabelSettingsForm = {
  printer: 'thermal',
  charLimit: 30,
  maxItems: 4,
  orderInfo: {
    alternatePhone: false,
    billingGstin: false,
    ewayBillNumber: false,
  },
  shipperInfo: {
    brandLogo: true,
    shipperName: true,
    shipperAddress: true,
    shipperPhone: true,
    gstin: true,
    returnName: true,
    returnAddress: true,
    returnPhone: true,
  },
  productInfo: {
    productCost: true,
  },
}

const fieldLabels = {
  orderInfo: {
    alternatePhone: 'Show alternate receiver phone',
    billingGstin: 'Show bill-to GSTIN for B2B orders',
    ewayBillNumber: 'Show e-way bill number',
  },
  shipperInfo: {
    brandLogo: 'Show seller logo when available',
    shipperName: 'Show ship-from name',
    shipperAddress: 'Show ship-from address',
    shipperPhone: 'Show ship-from mobile number',
    gstin: 'Show ship-from GSTIN',
    returnName: 'Show return name',
    returnAddress: 'Show return address',
    returnPhone: 'Show return address mobile number',
  },
  productInfo: {
    productCost: 'Show price and amount columns',
  },
} as const

const mockOrder = {
  name: 'Receiver Name',
  address: 'Address Line 1, Address Line 2 and Landmark',
  city: 'New Delhi',
  state: 'Delhi',
  pincode: '110001',
  phone: '+91 9876543210',
  alternatePhone: '+91 9988776655',
  orderId: 'ORD-1234567890',
  invoiceNumber: 'INV-2026-101',
  invoiceDate: '04/07/2026',
  ewayBillNumber: 'EWB-9012345678',
  awb: 'AWB-123456789012345',
  paymentType: 'cod',
  courier: 'Courier Name',
  weight: 1250,
  length: 28,
  breadth: 18,
  height: 12,
  billTo: {
    name: 'Ordering Person Name',
    addressLine1: 'Address Line 1',
    addressLine2: 'Address Line 2 and Landmark',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    phone: '+91 9123456780',
    gstin: '27ABCDE1234A1ZA',
  },
  shipper: {
    name: 'Company Name (Merchant)',
    address: 'Address Line 1, Address Line 2 and Landmark',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    phone: '+91 9090909090',
    gst: '29ABCDE1234A1Z5',
    logoUrl: '/brand/kourier-boyz-logo.png',
  },
  returnTo: {
    name: 'Shipper Name',
    address: 'Address Line 1, Address Line 2 and Landmark',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    phone: '+91 9000000000',
  },
  products: [
    { name: 'Product 1', qty: 1, price: 100 },
    { name: 'Product 2', qty: 2, price: 150 },
    { name: 'Product 3', qty: 1, price: 200 },
    { name: 'Product 4', qty: 1, price: 250 },
  ],
  totalAmount: 850,
}

function ToggleGroup({
  title,
  items,
  value,
  onChange,
}: {
  title: string
  items: Array<{ key: string; label: string }>
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}) {
  return (
    <Box>
      <Typography fontWeight="bold" gutterBottom>
        {title}
      </Typography>
      <FormGroup>
        {items.map((item) => (
          <FormControlLabel
            key={item.key}
            control={
              <Checkbox
                checked={Boolean(value[item.key])}
                onChange={(event) =>
                  onChange({
                    ...value,
                    [item.key]: event.target.checked,
                  })
                }
              />
            }
            label={item.label}
          />
        ))}
      </FormGroup>
    </Box>
  )
}

export default function LabelSettingsPage() {
  const { preferences, isLoading, savePreferences, saving } = useLabelPreferences()

  const { control, watch, handleSubmit, reset } = useForm<LabelSettingsForm>({
    defaultValues,
  })

  React.useEffect(() => {
    if (preferences) reset(mapApiToForm(preferences))
  }, [preferences, reset])

  const values = watch()

  const onSubmit = (data: LabelSettingsForm) => {
    savePreferences(mapFormToApi({ ...data, printer: 'thermal' }))
  }

  if (isLoading) return <Typography>Loading label preferences...</Typography>

  return (
    <Stack gap={2}>
      <PageHeading title="Label Settings" />
      <Grid container spacing={3} sx={{ p: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ ...glassStyles }}>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      4x6 Label Layout
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The new label format is fixed now. Green fields are always part of the layout when data is present, and only the optional fields below can be toggled seller by seller.
                    </Typography>
                  </Box>

                  <Divider />

                  <Controller
                    name="orderInfo"
                    control={control}
                    render={({ field }) => (
                      <ToggleGroup
                        title="Optional Customer And Billing Details"
                        items={Object.entries(fieldLabels.orderInfo).map(([key, label]) => ({
                          key,
                          label,
                        }))}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />

                  <Divider />

                  <Controller
                    name="shipperInfo"
                    control={control}
                    render={({ field }) => (
                      <ToggleGroup
                        title="Optional Seller Details"
                        items={Object.entries(fieldLabels.shipperInfo).map(([key, label]) => ({
                          key,
                          label,
                        }))}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />

                  <Divider />

                  <Controller
                    name="productInfo"
                    control={control}
                    render={({ field }) => (
                      <ToggleGroup
                        title="Optional Product Pricing"
                        items={Object.entries(fieldLabels.productInfo).map(([key, label]) => ({
                          key,
                          label,
                        }))}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />

                  <Divider />

                  <Box>
                    <Typography fontWeight="bold" gutterBottom>
                      Display Limits
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Controller
                        name="charLimit"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            label="Product name character limit"
                            size="small"
                            fullWidth
                          />
                        )}
                      />
                      <Controller
                        name="maxItems"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            label="Visible line items on label"
                            size="small"
                            fullWidth
                          />
                        )}
                      />
                    </Stack>
                  </Box>

                  <Divider />

                  <Stack direction="row" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </Stack>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <LabelPreview values={values} order={mockOrder} preferences={preferences} />
        </Grid>
      </Grid>
    </Stack>
  )
}
