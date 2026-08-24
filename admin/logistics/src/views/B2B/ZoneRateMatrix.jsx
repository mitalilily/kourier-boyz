import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  NumberInput,
  NumberInputField,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import CustomModal from 'components/Modal/CustomModal'
import FileUploader from 'components/upload/FileUploader'
import { useCouriers } from 'hooks/useCouriers'
import { useZones } from 'hooks/useZones'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { GenericTable } from 'views/Dashboard/Tables/components/GenericTable'
import { useB2BZoneRates } from '../../hooks/useB2BZoneRates'
import { b2bAdminService } from '../../services/b2bAdmin.service'
import { filterB2BRateCardCouriers } from '../../utils/b2bCourierFilters'

const STATIC_CHARGE_FIELDS = [
  'Docket Charge', 'Minimum ODA1 Charge', 'ODA1 Charge Per Kg', 'Minimum ODA2 Charge',
  'ODA2 Charge Per Kg', 'Minimum ODA3 Charge', 'ODA3 Charge Per Kg', 'Minimum ODA4 Charge',
  'ODA4 Charge Per Kg', 'Minimum RAS Charge', 'RAS Charge Per Kg', 'FSC Percentage',
  'ROV Owner Risk Charge', 'ROV Owner Percentage', 'ROV Carrier Charge', 'ROV Carrier Percentage',
  'Liquid ROV Owner Risk Charge', 'Liquid ROV Owner Percentage', 'Liquid ROV Carrier Charge',
  'Liquid ROV Carrier Percentage', 'Appointment Delivery Charge', 'Appointment Charge Per Kg',
  'FM Charge Per Kg', 'Minimum FM Charge', 'Minimum COD Charge', 'COD Charge Percentage',
  'To Pay Charge', 'Minimum Critical Pickup Charge', 'Critical Pickup Charge Per Kg',
  'Minimum Critical Delivery Charge', 'Critical Delivery Charge Per Kg', 'Minimum LR Charge',
  'Minimum Handling Charge Upto 50 Kg', 'Handling Charge Per Kg Upto 50 Kg',
  'Minimum Handling Charge 50 To 100 Kg', 'Handling Charge Per Kg 50 To 100 Kg',
  'Minimum Handling Charge 100 To 250 Kg', 'Handling Charge Per Kg 100 To 250 Kg',
  'Minimum Handling Charge 250 To 500 Kg', 'Handling Charge Per Kg 250 To 500 Kg',
  'Minimum Handling Charge More Than 500 Kg', 'Handling Charge Per Kg More Than 500 Kg',
  'Minimum Green Charge', 'Green Charge Per Kg', 'Additional RTO Charge', 'Volumetric Dividend',
]

const KOURIER_BOYZ_META_PREFIX = '__kourier-boyz_'
const SHIPPING_API_FIELD = `${KOURIER_BOYZ_META_PREFIX}use_shipping_charge_api`
const STATIC_META_PREFIX = `${KOURIER_BOYZ_META_PREFIX}zone_matrix_static_`
const DYNAMIC_FIELD_PREFIX = 'zoneMatrixDynamicCharge_'
const COMMISSION_FIELD = 'zoneMatrixCommissionPercentage'

const STATIC_CHARGE_CONFIG = {
  'Docket Charge': { payloadKey: 'awbCharges', dbKey: 'awb_charges' },
  'Minimum ODA1 Charge': { payloadKey: 'odaCharges', dbKey: 'oda_charges' },
  'ODA1 Charge Per Kg': { payloadKey: 'odaPerKgCharge', dbKey: 'oda_per_kg_charge' },
  'FSC Percentage': { payloadKey: 'fuelSurchargePercentage', dbKey: 'fuel_surcharge_percentage' },
  'ROV Owner Risk Charge': { customKey: 'rovOwnerMinimum' },
  'ROV Owner Percentage': { customKey: 'rovOwnerPercentage' },
  'ROV Carrier Charge': { customKey: 'rovCourierMinimum' },
  'ROV Carrier Percentage': { customKey: 'rovCourierPercentage' },
  'Appointment Delivery Charge': { customKey: 'specialDeliveryMinimum' },
  'Appointment Charge Per Kg': { customKey: 'specialDeliveryPerKg' },
  'Minimum COD Charge': { payloadKey: 'codFixedAmount', dbKey: 'cod_fixed_amount' },
  'COD Charge Percentage': { payloadKey: 'codPercentage', dbKey: 'cod_percentage' },
  'To Pay Charge': { customKey: 'fodCharge' },
  'Minimum Handling Charge Upto 50 Kg': { payloadKey: 'handlingSinglePiece', dbKey: 'handling_single_piece' },
  'Minimum Handling Charge 50 To 100 Kg': { payloadKey: 'handlingBelow100Kg', dbKey: 'handling_below_100_kg' },
  'Minimum Handling Charge 100 To 250 Kg': { payloadKey: 'handling100To200Kg', dbKey: 'handling_100_to_200_kg' },
  'Minimum Handling Charge More Than 500 Kg': { payloadKey: 'handlingAbove200Kg', dbKey: 'handling_above_200_kg' },
  'Minimum Green Charge': { customKey: 'greenTaxMinimum' },
  'Green Charge Per Kg': { customKey: 'greenTaxPerKg' },
  'Volumetric Dividend': { payloadKey: 'cftFactor', dbKey: 'cft_factor' },
}

const buildCourierScope = (courierId, couriers = []) => {
  if (!courierId) return {}
  const courier = couriers.find((c) => c.id?.toString() === courierId?.toString())
  return {
    courier_id: courier?.id,
    courierId: courier?.id,
    service_provider: courier?.serviceProvider ?? courier?.service_provider,
    serviceProvider: courier?.serviceProvider ?? courier?.service_provider,
  }
}

const csvEscape = (value) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const numeric = Number(value)
  return Number.isFinite(numeric) ? String(numeric) : ''
}

const toNumberOrZero = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const staticMetaKey = (label) => `${STATIC_META_PREFIX}${slugify(label)}`

const dynamicChargeKey = (name, index) =>
  `${DYNAMIC_FIELD_PREFIX}${index + 1}_${slugify(name) || 'charge'}`

const createMetadataDefinition = (label, order) => ({
  label,
  visible: true,
  group: 'Zone Matrix Settings',
  order,
  condition: '__metadata',
})

const createStaticDefinition = (label, unit = 'INR') => ({
  label,
  visible: true,
  group: 'Zone Matrix Static Charges',
  unit,
})

export const ZoneRateMatrix = ({ embedded = false } = {}) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure()
  const [selectedRate, setSelectedRate] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [useShippingApi, setUseShippingApi] = useState(false)
  const [commission, setCommission] = useState('')
  const [staticCharges, setStaticCharges] = useState({ 'Volumetric Dividend': '4500' })
  const [dynamicRules, setDynamicRules] = useState([])
  const [showZoneRates, setShowZoneRates] = useState(true)
  const [filters, setFilters] = useState({
    courierId: '',
    originZoneId: '',
    destinationZoneId: '',
  })

  const { data: rawCouriers = [] } = useCouriers({ businessType: 'b2b' })
  const couriers = filterB2BRateCardCouriers(rawCouriers)
  const { zones: b2bZones = [] } = useZones('B2B', { include_global: true })

  const courierScope = buildCourierScope(filters.courierId, couriers)
  const additionalChargesQueryKey = [
    'b2b-additional-charges',
    'zone-rate-matrix',
    courierScope.courierId || 'global',
    courierScope.serviceProvider || 'global',
  ]

  const { rates, isLoading, upsertRate, deleteRate, importRates } = useB2BZoneRates({
    courier_id: courierScope.courierId,
    service_provider: courierScope.serviceProvider,
    origin_zone_id: filters.originZoneId || undefined,
    destination_zone_id: filters.destinationZoneId || undefined,
  })

  const { data: additionalCharges, isFetching: isChargesLoading } = useQuery({
    queryKey: additionalChargesQueryKey,
    queryFn: () =>
      b2bAdminService.getAdditionalCharges({
        courier_id: courierScope.courierId || undefined,
        service_provider: courierScope.serviceProvider || undefined,
      }),
  })

  useEffect(() => {
    if (!additionalCharges) return

    const customFields = additionalCharges.custom_fields || {}
    const fieldDefinitions = additionalCharges.field_definitions || {}
    const nextStaticCharges = {}

    STATIC_CHARGE_FIELDS.forEach((label) => {
      const config = STATIC_CHARGE_CONFIG[label]
      if (config?.dbKey) {
        nextStaticCharges[label] = formatValue(additionalCharges[config.dbKey])
      } else if (config?.customKey) {
        nextStaticCharges[label] = formatValue(customFields[config.customKey])
      } else {
        nextStaticCharges[label] = formatValue(customFields[staticMetaKey(label)])
      }
    })

    if (!nextStaticCharges['Volumetric Dividend']) {
      nextStaticCharges['Volumetric Dividend'] = '4500'
    }

    const nextDynamicRules = Object.entries(customFields)
      .filter(([key]) => key.startsWith(DYNAMIC_FIELD_PREFIX))
      .sort(([leftKey], [rightKey]) => {
        const leftOrder = fieldDefinitions[leftKey]?.order ?? Number.MAX_SAFE_INTEGER
        const rightOrder = fieldDefinitions[rightKey]?.order ?? Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder
      })
      .map(([key, value]) => ({
        name: fieldDefinitions[key]?.label || key.replace(DYNAMIC_FIELD_PREFIX, ''),
        value: formatValue(value),
      }))

    setUseShippingApi(Boolean(customFields[SHIPPING_API_FIELD]))
    setCommission(formatValue(customFields[COMMISSION_FIELD]))
    setStaticCharges(nextStaticCharges)
    setDynamicRules(nextDynamicRules)
  }, [additionalCharges])

  const saveChargesMutation = useMutation({
    mutationFn: (payload) => b2bAdminService.upsertAdditionalCharges(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-additional-charges'] })
      toast({
        title: 'B2B charge settings saved',
        description: 'Static charges, dynamic charges and the shipping API toggle are now persisted.',
        status: 'success',
        duration: 3500,
        isClosable: true,
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to save B2B charge settings',
        description: error?.response?.data?.error || error?.message || 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    },
  })

  const [rateForm, setRateForm] = useState({
    originZoneId: '',
    destinationZoneId: '',
    ratePerKg: '',
    minCharge: '',
    maxWeightLimit: '',
  })

  const handleOpenModal = (rate) => {
    if (rate) {
      setSelectedRate(rate)
      setRateForm({
        originZoneId: rate.origin_zone_id,
        destinationZoneId: rate.destination_zone_id,
        ratePerKg: Number(rate.rate_per_kg || 0),
        minCharge: rate.min_charge ? Number(rate.min_charge) : '',
        maxWeightLimit: rate.max_weight_limit ? Number(rate.max_weight_limit) : '',
      })
    } else {
      setSelectedRate(null)
      setRateForm({
        originZoneId: '',
        destinationZoneId: '',
        ratePerKg: '',
        minCharge: '',
        maxWeightLimit: '',
      })
    }
    onOpen()
  }

  const handleSaveRate = () => {
    if (!rateForm.originZoneId || !rateForm.destinationZoneId || !rateForm.ratePerKg) {
      toast({ title: 'Please fill origin, destination and rate', status: 'warning' })
      return
    }

    upsertRate.mutate(
      {
        id: selectedRate?.id,
        originZoneId: rateForm.originZoneId,
        destinationZoneId: rateForm.destinationZoneId,
        ratePerKg: Number(rateForm.ratePerKg),
        minCharge: rateForm.minCharge ? Number(rateForm.minCharge) : undefined,
        maxWeightLimit: rateForm.maxWeightLimit ? Number(rateForm.maxWeightLimit) : undefined,
        courierScope,
      },
      {
        onSuccess: () => {
          onClose()
          setSelectedRate(null)
        },
      },
    )
  }

  const handleDeleteRate = (id) => {
    deleteRate.mutate(id)
  }

  const handleImport = async (files) => {
    if (!files?.length) return
    const file = files[0]
    const formData = new FormData()
    formData.append('file', file.file)
    if (courierScope.courierId) formData.append('courier_id', courierScope.courierId)
    if (courierScope.serviceProvider)
      formData.append('service_provider', courierScope.serviceProvider)

    try {
      setUploading(true)
      await importRates.mutateAsync(formData)
      toast({ title: 'Rates imported', status: 'success', duration: 3000, isClosable: true })
    } catch (error) {
      toast({
        title: 'Failed to import rates',
        description: error?.message || 'Unknown error',
        status: 'error',
      })
    } finally {
      setUploading(false)
      onImportClose()
    }
  }

  const sortedZones = b2bZones.slice().sort((a, b) => a.code.localeCompare(b.code))
  const rateMap = new Map(rates.map((r) => [`${r.origin_zone_id}|${r.destination_zone_id}`, r]))

  const handleDownloadSampleCsv = () => {
    const sampleZones = sortedZones.length >= 2 ? sortedZones : [
      { code: 'W1', name: 'West One' },
      { code: 'S1', name: 'South One' },
      { code: 'N1', name: 'North One' },
    ]
    const rows = sampleZones.flatMap((originZone, originIndex) =>
      sampleZones.map((destinationZone, destinationIndex) => [
        originZone.code || originZone.name,
        destinationZone.code || destinationZone.name,
        (14.5 + originIndex * 2.25 + destinationIndex * 1.75).toFixed(2),
      ]),
    )

    downloadCsv('b2b-zone-rate-matrix-sample.csv', [
      ['origin_zone_code', 'destination_zone_code', 'rate_per_kg'],
      ...rows,
    ])
  }

  const handleSaveChargeSettings = () => {
    const existingCustomFields = additionalCharges?.custom_fields || {}
    const existingFieldDefinitions = additionalCharges?.field_definitions || {}
    const customFields = { ...existingCustomFields }
    const fieldDefinitions = { ...existingFieldDefinitions }
    const payload = {
      courier_id: courierScope.courierId || undefined,
      service_provider: courierScope.serviceProvider || undefined,
      customFields,
      fieldDefinitions,
    }

    Object.keys(customFields).forEach((key) => {
      if (key.startsWith(DYNAMIC_FIELD_PREFIX)) {
        delete customFields[key]
        delete fieldDefinitions[key]
      }
    })

    customFields[SHIPPING_API_FIELD] = Boolean(useShippingApi)
    fieldDefinitions[SHIPPING_API_FIELD] = createMetadataDefinition(
      'Use Shipping Charge API',
      1,
    )

    if (commission !== '') {
      customFields[COMMISSION_FIELD] = toNumberOrZero(commission)
      fieldDefinitions[COMMISSION_FIELD] = {
        label: 'Commission',
        visible: true,
        group: 'Zone Matrix Dynamic Charges',
        order: 2,
        unit: '%',
        chargeType: 'percent',
        appliesTo: 'total',
      }
    } else {
      delete customFields[COMMISSION_FIELD]
      delete fieldDefinitions[COMMISSION_FIELD]
    }

    STATIC_CHARGE_FIELDS.forEach((label, index) => {
      const value = staticCharges[label]
      const numericValue = toNumberOrZero(value)
      const config = STATIC_CHARGE_CONFIG[label]

      if (config?.payloadKey) {
        payload[config.payloadKey] = numericValue
        return
      }

      if (config?.customKey) {
        customFields[config.customKey] = numericValue
        fieldDefinitions[config.customKey] = createStaticDefinition(
          label,
          label.toLowerCase().includes('percentage') ? '%' : 'INR',
        )
        return
      }

      const key = staticMetaKey(label)
      if (value === '') {
        delete customFields[key]
        delete fieldDefinitions[key]
        return
      }
      customFields[key] = numericValue
      fieldDefinitions[key] = createMetadataDefinition(label, 100 + index)
    })

    dynamicRules.forEach((rule, index) => {
      const name = String(rule.name || '').trim()
      const value = toNumberOrZero(rule.value)
      if (!name || value <= 0) return
      const key = dynamicChargeKey(name, index)
      customFields[key] = value
      fieldDefinitions[key] = {
        label: name,
        visible: true,
        group: 'Zone Matrix Dynamic Charges',
        order: 1000 + index,
        unit: 'INR',
        chargeType: 'flat',
        appliesTo: 'total',
      }
    })

    saveChargesMutation.mutate(payload)
  }

  return (
    <Stack spacing={embedded ? 4 : 6} pt={embedded ? 0 : { base: '120px', md: '75px' }}>
      <Flex justify="space-between" align="center">
        <Text fontSize="2xl" fontWeight="bold">
          B2B Zone-to-Zone Rates
        </Text>
        <HStack>
          <Button colorScheme="blue" onClick={() => handleOpenModal(null)}>
            Add Rate
          </Button>
          <Button variant="outline" onClick={onImportOpen}>
            Import CSV
          </Button>
          <Button variant="outline" onClick={handleDownloadSampleCsv}>
            Download Sample CSV
          </Button>
        </HStack>
      </Flex>

      <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
        <FormControl maxW={{ base: '100%', md: '250px' }}>
          <FormLabel>Courier</FormLabel>
          <Select
            placeholder="Select courier"
            value={filters.courierId}
            onChange={(e) => setFilters((prev) => ({ ...prev, courierId: e.target.value }))}
          >
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl maxW={{ base: '100%', md: '220px' }}>
          <FormLabel>Origin Zone</FormLabel>
          <Select
            placeholder="All"
            value={filters.originZoneId}
            onChange={(e) => setFilters((prev) => ({ ...prev, originZoneId: e.target.value }))}
          >
            {b2bZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name} ({zone.code})
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl maxW={{ base: '100%', md: '220px' }}>
          <FormLabel>Destination Zone</FormLabel>
          <Select
            placeholder="All"
            value={filters.destinationZoneId}
            onChange={(e) => setFilters((prev) => ({ ...prev, destinationZoneId: e.target.value }))}
          >
            {b2bZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name} ({zone.code})
              </option>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {sortedZones.length > 0 && (
        <Box>
          <Text fontWeight="semibold" mb={3}>
            Zone-to-Zone Matrix ({filters.courierId ? 'Courier specific' : 'Select courier'})
          </Text>
          <TableContainer borderWidth="1px" borderRadius="md" overflow="auto">
            <Table size="sm" variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  <Th whiteSpace="nowrap">From / To</Th>
                  {sortedZones.map((zone) => (
                    <Th key={`matrix-header-${zone.id}`} whiteSpace="nowrap">
                      {zone.code}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {sortedZones.map((originZone) => (
                  <Tr key={`matrix-row-${originZone.id}`}>
                    <Th bg="gray.50" position="sticky" left={0} zIndex={1} whiteSpace="nowrap">
                      {originZone.code}
                    </Th>
                    {sortedZones.map((destZone) => {
                      const rate = rateMap.get(`${originZone.id}|${destZone.id}`)

                      if (!rate) {
                        return (
                          <Td key={`${originZone.id}-${destZone.id}`} textAlign="center">
                            —
                          </Td>
                        )
                      }

                      const ratePerKg = Number(rate.rate_per_kg ?? rate.ratePerKg ?? 0)
                      const minCharge = Number(rate.min_charge ?? rate.minCharge ?? 0)
                      const maxWeight = rate.max_weight_limit ?? rate.maxWeightLimit

                      return (
                        <Td key={`${originZone.id}-${destZone.id}`} whiteSpace="nowrap">
                          <Text fontWeight="semibold">₹ {ratePerKg.toFixed(2)}</Text>
                          {minCharge > 0 && (
                            <Text fontSize="xs" color="gray.600">
                              Min ₹ {minCharge.toFixed(2)}
                            </Text>
                          )}
                          {maxWeight && (
                            <Text fontSize="xs" color="gray.600">
                              Max {Number(maxWeight)} kg
                            </Text>
                          )}
                        </Td>
                      )
                    })}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Box borderWidth="1px" borderRadius="6px" overflow="hidden">
        <Flex px={5} py={4} justify="space-between" align="center" bg="white">
          <Box>
            <Text fontWeight="700" fontSize="lg">Zone Rates</Text>
            <Text fontSize="sm" color="gray.500">
              Open this section when you need to review or edit individual zone rows.
            </Text>
          </Box>
          <Button variant="outline" onClick={() => setShowZoneRates((value) => !value)}>
            {showZoneRates ? 'Hide Zone Rates' : 'Show Zone Rates'}
          </Button>
        </Flex>
        {showZoneRates && (
          <Box px={4} pb={4}>
            <GenericTable
        title=""
        data={rates.map((rate, idx) => ({
          sno: idx + 1,
          origin: rate.origin_zone_id,
          destination: rate.destination_zone_id,
          rate_per_kg: Number(rate.rate_per_kg || 0),
          min_charge: rate.min_charge ? Number(rate.min_charge) : 0,
          max_weight_limit: rate.max_weight_limit ? Number(rate.max_weight_limit) : '-',
          id: rate.id,
        }))}
        captions={[
          'S.No',
          'Origin Zone',
          'Destination Zone',
          'Rate / Kg',
          'Min Charge',
          'Max Weight',
          'Actions',
        ]}
        columnKeys={[
          'sno',
          'origin',
          'destination',
          'rate_per_kg',
          'min_charge',
          'max_weight_limit',
        ]}
        loading={isLoading}
        renderers={{
          origin: (value) => {
            const zone = b2bZones.find((z) => z.id === value)
            return zone ? `${zone.name} (${zone.code})` : value
          },
          destination: (value) => {
            const zone = b2bZones.find((z) => z.id === value)
            return zone ? `${zone.name} (${zone.code})` : value
          },
          rate_per_kg: (val) => `₹ ${Number(val || 0).toFixed(2)}`,
          min_charge: (val) => `₹ ${Number(val || 0).toFixed(2)}`,
          max_weight_limit: (val) => (val && val !== '-' ? `${val} kg` : 'No limit'),
        }}
        renderActions={(row) => (
          <HStack>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenModal(rates.find((rate) => rate.id === row.id))}
            >
              Edit
            </Button>
            <Button size="sm" colorScheme="red" onClick={() => handleDeleteRate(row.id)}>
              Delete
            </Button>
          </HStack>
        )}
            />
          </Box>
        )}
      </Box>

      <Box borderWidth="1px" borderRadius="6px" overflow="hidden">
        <Flex bg="brand.500" color="white" px={5} py={4} justify="space-between" align="center">
          <Text fontWeight="700">Static Charges</Text>
          <Button
            size="sm"
            colorScheme="whiteAlpha"
            isLoading={saveChargesMutation.isPending || isChargesLoading}
            onClick={handleSaveChargeSettings}
          >
            Submit
          </Button>
        </Flex>
        <Box p={5}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mb={5}>
            <FormControl>
              <FormLabel>Use Shipping Charge API</FormLabel>
              <HStack><Switch colorScheme="brand" isChecked={useShippingApi} onChange={(e) => setUseShippingApi(e.target.checked)} /><Text fontSize="sm">Enable</Text></HStack>
            </FormControl>
            <FormControl>
              <FormLabel>Commission %</FormLabel>
              <Input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />
            </FormControl>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 3, xl: 6 }} spacing={4}>
            {STATIC_CHARGE_FIELDS.map((label) => (
              <FormControl key={label}>
                <FormLabel fontSize="xs" minH="32px" display="flex" alignItems="flex-end">{label}</FormLabel>
                <Input type="number" value={staticCharges[label] || ''} onChange={(e) => setStaticCharges((current) => ({ ...current, [label]: e.target.value }))} />
              </FormControl>
            ))}
          </SimpleGrid>
        </Box>
      </Box>

      <Box borderWidth="1px" borderRadius="6px" overflow="hidden">
        <Flex bg="brand.500" color="white" px={5} py={4} justify="space-between" align="center">
          <Text fontWeight="700">Dynamic Additional Charges</Text>
          <Button size="sm" colorScheme="whiteAlpha" onClick={() => setDynamicRules((rules) => [...rules, { name: '', value: '' }])}>Add Rule</Button>
        </Flex>
        <Stack p={5} spacing={3}>
          {!dynamicRules.length && <Text color="gray.500">No additional rules configured.</Text>}
          {dynamicRules.map((rule, index) => (
            <HStack key={index}>
              <Input placeholder="Rule name" value={rule.name} onChange={(e) => setDynamicRules((rules) => rules.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} />
              <Input type="number" placeholder="Charge" value={rule.value} onChange={(e) => setDynamicRules((rules) => rules.map((item, itemIndex) => itemIndex === index ? { ...item, value: e.target.value } : item))} />
              <Button colorScheme="red" variant="ghost" onClick={() => setDynamicRules((rules) => rules.filter((_, itemIndex) => itemIndex !== index))}>Delete</Button>
            </HStack>
          ))}
        </Stack>
      </Box>

      <CustomModal
        isOpen={isOpen}
        onClose={() => {
          onClose()
          setSelectedRate(null)
        }}
        title={selectedRate ? 'Edit Zone Rate' : 'Add Zone Rate'}
        footer={
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" isLoading={upsertRate.isPending} onClick={handleSaveRate}>
              Save
            </Button>
          </HStack>
        }
      >
        <Stack spacing={3}>
          <FormControl isRequired>
            <FormLabel>Origin Zone</FormLabel>
            <Select
              placeholder="Select origin"
              value={rateForm.originZoneId}
              onChange={(e) => setRateForm((prev) => ({ ...prev, originZoneId: e.target.value }))}
            >
              {b2bZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} ({zone.code})
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Destination Zone</FormLabel>
            <Select
              placeholder="Select destination"
              value={rateForm.destinationZoneId}
              onChange={(e) =>
                setRateForm((prev) => ({ ...prev, destinationZoneId: e.target.value }))
              }
            >
              {b2bZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} ({zone.code})
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Rate per Kg (₹)</FormLabel>
            <NumberInput
              min={0}
              value={rateForm.ratePerKg}
              onChange={(value) => setRateForm((prev) => ({ ...prev, ratePerKg: value }))}
            >
              <NumberInputField />
            </NumberInput>
          </FormControl>
          <HStack spacing={3}>
            <FormControl>
              <FormLabel>Minimum Charge (₹)</FormLabel>
              <NumberInput
                min={0}
                value={rateForm.minCharge}
                onChange={(value) => setRateForm((prev) => ({ ...prev, minCharge: value }))}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel>Max Weight Limit (Kg)</FormLabel>
              <NumberInput
                min={0}
                value={rateForm.maxWeightLimit}
                onChange={(value) => setRateForm((prev) => ({ ...prev, maxWeightLimit: value }))}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
          </HStack>
        </Stack>
      </CustomModal>

      <CustomModal
        isOpen={isImportOpen}
        onClose={onImportClose}
        title="Import Zone Rates"
        footer={
          <HStack>
            <Button variant="ghost" onClick={onImportClose}>
              Close
            </Button>
          </HStack>
        }
      >
        <Text fontSize="sm" mb={3}>
          Upload a CSV file with columns:{' '}
          <b>origin_zone_code, destination_zone_code, rate_per_kg</b>.
        </Text>
        <Button size="sm" variant="outline" mb={4} onClick={handleDownloadSampleCsv}>
          Download Sample CSV
        </Button>
        <FileUploader
          maxSizeMb={5}
          uploadLoading={uploading}
          showUploadButton={false}
          onUploaded={handleImport}
        />
      </CustomModal>
    </Stack>
  )
}

export default ZoneRateMatrix
