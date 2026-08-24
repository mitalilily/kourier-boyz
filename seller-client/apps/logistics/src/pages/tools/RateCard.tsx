// src/pages/client/RateCard.tsx

import {
  Avatar,
  Box,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import Papa from 'papaparse'
import { useState } from 'react'
import { MdCalculate, MdDownload } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { FilterBar, type FilterField } from '../../components/FilterBar'
import ListPageLayout from '../../components/UI/layout/ListPageLayout'
import { SmartTabs } from '../../components/UI/tab/Tabs'
import type { Column } from '../../components/UI/table/DataTable'
import DataTable from '../../components/UI/table/DataTable'
import TableSkeleton from '../../components/UI/table/TableSkeleton'
import { useAllCouriers, useShippingRates } from '../../hooks/Integrations/useCouriers'
import { useZones } from '../../hooks/useZones'
import { courierLogos, defaultLogo } from '../../utils/constants'

const INR_SYMBOL = '\u20B9'
const CANONICAL_B2C_ZONE_CODES = ['A', 'B', 'C', 'D', 'E', 'F']
const HIDDEN_B2B_COURIER_NAMES = new Set(['global rates', 'global rate', 'movin express ez'])
const LEGACY_ZONE_RATE_KEYS: Record<string, string[]> = {
  A: ['Within City', 'Within city', 'Local', 'Within city and local shipments.'],
  B: ['Metro to Metro', 'Metro city to metro city', 'Metro city to metro city.'],
  C: ['Metro to Non Metro', 'Non Metro to Metro', 'Metro to non-metro and non-metro to metro.'],
  D: ['Rest of India', 'ROI', 'Rest of India.'],
  E: ['North East', 'Northeast', 'Jammu and Kashmir', 'Special Zone'],
  F: ['Remote', 'ODA', 'Remote and ODA service locations.'],
}

const normalizeZoneCode = (zone: { code?: string }) => String(zone?.code || '').trim().toUpperCase()
const isHiddenB2BCourierName = (value: unknown) =>
  HIDDEN_B2B_COURIER_NAMES.has(String(value || '').trim().toLowerCase())
const isCanonicalZoneName = (zone: { code?: string; name?: string }) =>
  new RegExp(`^zone\\s*${normalizeZoneCode(zone)}$`, 'i').test(String(zone?.name || '').trim())

const getB2CDisplayZones = (zones: Array<{ code: string; description?: string; id?: string; name: string }>) => {
  const byCode = zones.reduce<Record<string, { code: string; description?: string; id?: string; name: string }>>(
    (acc, zone) => {
      const code = normalizeZoneCode(zone)
      if (!CANONICAL_B2C_ZONE_CODES.includes(code)) return acc
      if (!acc[code] || isCanonicalZoneName(zone)) acc[code] = zone
      return acc
    },
    {},
  )

  return CANONICAL_B2C_ZONE_CODES.map((code) => ({
    id: byCode[code]?.id || code,
    code,
    name: `Zone ${code}`,
    sourceName: byCode[code]?.name || `Zone ${code}`,
  }))
}

interface ShippingRate {
  id: string | number
  courier_name: string
  mode: string
  min_weight: number
  cod_charges?: number | string
  cod_percent?: number | string
  other_charges?: number | string
  rates: {
    [zone: string]: {
      forward?: number | string
      rto?: number | string
      description?: string
      forward_per_kg?: number | string
      rto_per_kg?: number | string
      min_weight?: number
    }
  }
}

const getZoneRates = (
  rates: ShippingRate['rates'] | undefined,
  zone: { code: string; name: string; sourceName: string },
) => {
  const candidates = [
    zone.sourceName,
    zone.name,
    `ZONE ${zone.code}`,
    `Zone ${zone.code}`,
    zone.code,
    ...(LEGACY_ZONE_RATE_KEYS[zone.code] || []),
  ].filter(Boolean)

  return candidates.map((key) => rates?.[key]).find(Boolean) || {}
}

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')

const getCourierDisplayName = (row: ShippingRate) => {
  const courierName = String(row.courier_name || '').trim()
  const mode = String(row.mode || '').trim()
  if (!mode || courierName.toLowerCase().includes(mode.toLowerCase())) return courierName
  return `${courierName} ${titleCase(mode)}`
}

// --- B2C Table ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const B2CClientTable = ({ data, zones }: { data: ShippingRate[]; zones: any[] }) => {
  const displayZones = getB2CDisplayZones(zones)
  const columns: Column<ShippingRate>[] = [
    {
      id: 'courier_name',
      label: 'Courier',
      render: (_, row) => {
        const displayName = getCourierDisplayName(row)
        const logoSrc =
          Object.entries(courierLogos)?.find(([key]) =>
            row?.courier_name?.toLowerCase().includes(key.toLowerCase()),
          )?.[1] ?? defaultLogo
        return (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar
              src={logoSrc || defaultLogo}
              alt={displayName}
              sx={{ width: 24, height: 24 }}
            />
            <Typography fontWeight={500}>{displayName}</Typography>
          </Stack>
        )
      },
    },
    { id: 'min_weight', label: 'Min Weight (kg)' },
    ...displayZones.map(
      (zone) =>
        ({
          id: zone.code,
          label: `${zone.name} (F | RTO)`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          render: (_: any, row: any) => {
            const rates = getZoneRates(row.rates, zone)

            const forward = rates.forward ?? 'NA'
            const rto = rates.rto ?? 'NA'

            return `${INR_SYMBOL}${forward} | ${INR_SYMBOL}${rto}`
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    ),

    {
      id: 'cod',
      label: 'COD (Charges | %)',
      render: (_, row) => `${INR_SYMBOL}${row.cod_charges ?? '0'} | ${row.cod_percent ?? '0'}%`,
    },
    {
      id: 'other',
      label: 'Other Charges',
      render: (_, row) => `${INR_SYMBOL}${row.other_charges ?? '0'}`,
    },
  ]

  return (
    <DataTable
      rows={data}
      columns={columns}
      title="Shipping Rate Card - B2C"
      totalCount={data.length}
    />
  )
}

// --- B2B Table ---
const B2BClientTable = ({
  data,
  zones,
}: {
  data: ShippingRate[]
  zones: { code: string; id: string; description: string; name: string }[]
}) => {
  if (!data?.length) {
    return <Typography>No B2B rates available</Typography>
  }

  return (
    <Stack spacing={3}>
      {data.map((courier) => (
        <Card key={courier.courier_name} sx={{ p: 2 }}>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">{courier.courier_name}</Typography>
              <Typography variant="body2">
                Zone-to-zone B2B rates are shown per kg for the assigned plan.
              </Typography>
            </Stack>

            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Origin \ Destination</TableCell>
                  {zones.map((zone) => (
                    <TableCell key={zone.id || zone.code}>{zone.code || zone.name}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {zones.map((originZone) => {
                  return (
                    <TableRow key={originZone.id || originZone.code}>
                      <TableCell>{originZone.code || originZone.name}</TableCell>
                      {zones.map((destinationZone) => {
                        const matrixRates =
                          (courier.rates as any)?.[originZone.name]?.[destinationZone.name] ||
                          (courier.rates as any)?.[originZone.code]?.[destinationZone.code] ||
                          {}
                        const value = matrixRates.forward_per_kg ?? matrixRates.forward

                        return (
                          <TableCell key={destinationZone.id || destinationZone.code}>
                            {value !== undefined && value !== null && value !== 'NA'
                              ? `${INR_SYMBOL}${value}`
                              : 'NA'}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}

// --- Main Component ---
const RateCard = () => {
  const navigate = useNavigate()
  const [businessType, setBusinessType] = useState<'b2c' | 'b2b'>('b2c') // 0 = B2C, 1 = B2B
  const [filters, setFilters] = useState({
    courier: [] as string[],
    min_weight: '',
  })

  const { zones } = useZones(businessType)
  const { data: couriers } = useAllCouriers()
  const { data, isLoading, isError } = useShippingRates({ ...filters, businessType: businessType })

  const rates: ShippingRate[] = [...((data || []) as ShippingRate[])]
    .filter((rate) => businessType !== 'b2b' || !isHiddenB2BCourierName(getCourierDisplayName(rate)))
    .sort((a, b) => getCourierDisplayName(a).localeCompare(getCourierDisplayName(b)))
  const b2cDisplayZones = getB2CDisplayZones(zones)
  const courierOptions = Array.from(
    new Set([
      ...((couriers || []) as string[]).filter(
        (courier) => businessType !== 'b2b' || !isHiddenB2BCourierName(courier),
      ),
      ...rates.map((rate) => rate.courier_name).filter(Boolean),
    ]),
  ).sort((a, b) => a.localeCompare(b))
  const activeFilterCount = Object.values(filters).filter((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  ).length

  console.log('rates', rates)

  // CSV export
  const handleExportCSV = (): void => {
    const csvData = rates.map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base: Record<string, any> = {
        Courier: r.courier_name,
        Mode: r.mode,
        'Min Weight': r.min_weight,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportZones = businessType === 'b2c' ? b2cDisplayZones : zones
      exportZones.forEach((zone: any) => {
        // NOTE: UI tables use `zone.name` as the key into `rates`, so CSV export
        // should use the same to avoid returning NA for all values.
        const zoneRates = businessType === 'b2c' ? getZoneRates(r.rates, zone) : r.rates?.[zone.name] || {}
        if (businessType === 'b2b') {
          base[`${zone.name} (Per Kg)`] = `F: ${INR_SYMBOL}${zoneRates.forward_per_kg ?? 'NA'} | RTO: ${INR_SYMBOL}${
            zoneRates.rto_per_kg ?? 'NA'
          }`
        } else {
          base[`${zone.name} (F | RTO)`] = `F: ${INR_SYMBOL}${zoneRates.forward ?? 'NA'} | RTO: ${INR_SYMBOL}${
            zoneRates.rto ?? 'NA'
          }`
        }
      })

      base['COD Charges'] = r.cod_charges ?? 'N/A'
      base['COD %'] = r.cod_percent ?? 'N/A'
      base['Other Charges'] = r.other_charges ?? 'N/A'

      return base
    })

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `rate_card_${businessType}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filter fields (courier + min_weight only, business type comes from tab)
  const filterFields: FilterField[] = [
    {
      name: 'courier',
      label: 'Courier',
      type: 'multiselect',
      options: courierOptions.map((c: string) => ({ label: c, value: c })),
    },
    { name: 'min_weight', label: 'Min Weight (kg)', type: 'text', placeholder: 'Enter min weight' },
  ]

  const controls = (
    <Box sx={{ px: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent={'space-between'}
        alignItems="center"
      >
        <Box>
          <SmartTabs
            tabs={[
              { label: 'B2C', value: 'b2c' },
              { label: 'B2B', value: 'b2b' },
            ]}
            value={businessType}
            onChange={(value) => setBusinessType(value)}
          />
        </Box>
        <FilterBar
          fields={filterFields}
          defaultValues={filters}
          onApply={(applied) => {
            setFilters((prev) => ({
              ...prev,
              ...applied,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              courier: applied?.courier?.map((cour) => (cour as any)?.value),
            }))
          }}
          mode="button"
          buttonLabel="Filters"
          appliedCount={activeFilterCount}
        />
      </Stack>
    </Box>
  )

  const table = isLoading ? (
    <TableSkeleton />
  ) : isError ? (
    <Typography color="error">Error loading shipping rates</Typography>
  ) : businessType === 'b2b' ? (
    <B2BClientTable zones={zones} data={rates} />
  ) : (
    <B2CClientTable data={rates} zones={zones} />
  )

  return (
    <ListPageLayout
      title="Rate Card"
      description="View and manage shipping rates for your couriers"
      actions={[
        {
          label: 'Calculate Rates',
          onClick: () => navigate('/tools/rate_calculator'),
          icon: <MdCalculate />,
          variant: 'outlined',
        },
        {
          label: 'Download Rate Card',
          onClick: handleExportCSV,
          icon: <MdDownload />,
          variant: 'contained',
        },
      ]}
      controls={controls}
    >
      {table}
    </ListPageLayout>
  )
}

export default RateCard
