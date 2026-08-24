import { DeleteIcon, EditIcon } from '@chakra-ui/icons'
import { Badge, Box, Flex, IconButton, Text } from '@chakra-ui/react'
import { useDeleteB2CZone } from 'hooks/useCouriers'
import { useMemo } from 'react'
import { GenericTable } from 'views/Dashboard/Tables/components/GenericTable'

const INR_SYMBOL = '\u20B9'
const CANONICAL_B2C_ZONE_CODES = ['A', 'B', 'C', 'D', 'E', 'F']
const LEGACY_ZONE_RATE_KEYS = {
  A: ['Within City', 'Within city', 'Local', 'Within city and local shipments.'],
  B: ['Metro to Metro', 'Metro city to metro city', 'Metro city to metro city.'],
  C: ['Metro to Non Metro', 'Non Metro to Metro', 'Metro to non-metro and non-metro to metro.'],
  D: ['Rest of India', 'ROI', 'Rest of India.'],
  E: ['North East', 'Northeast', 'Jammu and Kashmir', 'Special Zone'],
  F: ['Remote', 'ODA', 'Remote and ODA service locations.'],
}

const normalizeZoneCode = (zone) => String(zone?.code || '').trim().toUpperCase()
const isCanonicalZoneName = (zone) =>
  new RegExp(`^zone\\s*${normalizeZoneCode(zone)}$`, 'i').test(String(zone?.name || '').trim())

const getB2CDisplayZones = (zones = []) => {
  const byCode = zones.reduce((acc, zone) => {
    const code = normalizeZoneCode(zone)
    if (!CANONICAL_B2C_ZONE_CODES.includes(code)) return acc
    if (!acc[code] || isCanonicalZoneName(zone)) acc[code] = zone
    return acc
  }, {})

  return CANONICAL_B2C_ZONE_CODES.map((code) => ({
    id: byCode[code]?.id || code,
    code,
    name: `Zone ${code}`,
    sourceName: byCode[code]?.name || `Zone ${code}`,
  }))
}

const getZoneValue = (source, zone) => {
  const candidates = [
    zone.sourceName,
    zone.name,
    `ZONE ${zone.code}`,
    `Zone ${zone.code}`,
    zone.code,
    ...(LEGACY_ZONE_RATE_KEYS[zone.code] || []),
  ].filter(Boolean)

  return candidates.map((key) => source?.[key]).find(Boolean) || {}
}

export const B2CTable = ({ data, zones, onEdit, planId, loading }) => {
  const deleteB2CZoneMutation = useDeleteB2CZone(planId)

  const renderSlabSummary = (slabs = [], fallbackRate) => {
    if (!slabs.length) return fallbackRate ? `${INR_SYMBOL}${fallbackRate}` : 'NA'
    const first = slabs[0]
    const last = slabs[slabs.length - 1]
    return `${slabs.length} slabs (${first.weight_from}-${last.weight_to ?? 'open'} kg)`
  }

  const columns = useMemo(() => {
    const displayZones = getB2CDisplayZones(zones)
    const zoneColumns =
      displayZones.map((zone) => ({
        key: zone.code,
        label: `${zone.name} (F | RTO)`,
        width: '180px',
        renderer: (_, row) => {
          const rates = getZoneValue(row.rates, zone)
          const zoneSlabs = getZoneValue(row.zone_slabs, zone)
          return `${renderSlabSummary(zoneSlabs.forward, rates.forward)} | ${renderSlabSummary(zoneSlabs.rto, rates.rto)}`
        },
      })) || []

    const preColumns = [
      {
        key: 'courier_info',
        label: 'Courier Info',
        width: '200px',
        renderer: (_, row) => {
          const serviceProvider = row.service_provider || row.serviceProvider
          return (
            <Box>
              <Text fontWeight="semibold">{row.courier_name || 'N/A'}</Text>
              {serviceProvider && (
                <Text fontSize="xs" color="gray.600" mt={0.5}>
                  Provider: <Badge colorScheme="green" fontSize="xs">{serviceProvider}</Badge>
                </Text>
              )}
            </Box>
          )
        },
      },
    ]

    const postColumns = [
      {
        key: 'cod',
        label: 'COD (Charges | %)',
        width: '200px',
        renderer: (_, row) => `${INR_SYMBOL}${row.cod_charges ?? '0'} | ${row.cod_percent ?? '0'}%`,
      },
      {
        key: 'other',
        label: 'Other Charges',
        width: '200px',
        renderer: (_, row) => `${INR_SYMBOL}${row.other_charges ?? '0'}`,
      },
    ]

    return [...preColumns, ...zoneColumns, ...postColumns]
  }, [zones])

  return (
    <GenericTable
      title="Shipping Rate Card - B2C"
      columnKeys={columns.map((c) => c.key)}
      captions={columns.map((c) => c.label)}
      renderers={Object.fromEntries(
        columns.filter((c) => c.renderer).map((c) => [c.key, c.renderer]),
      )}
      renderActions={(row) => (
        <Flex gap={2}>
          <IconButton
            aria-label="Edit"
            icon={<EditIcon />}
            size="sm"
            colorScheme="yellow"
            onClick={() => onEdit(row)}
          />
          <IconButton
            aria-label="Delete Rate Card"
            icon={<DeleteIcon />}
            size="sm"
            colorScheme="red"
            onClick={() => {
              deleteB2CZoneMutation.mutate({
                courierId: row.courier_id,
                serviceProvider: row.service_provider || row.serviceProvider,
                mode: row.mode,
              })
            }}
          />
        </Flex>
      )}
      data={data}
      loading={loading}
      paginated={false}
      columnWidths={Object.fromEntries(columns.map((c) => [c.key, c.width]))}
    />
  )
}
