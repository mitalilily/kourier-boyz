import { AddIcon, QuestionOutlineIcon } from '@chakra-ui/icons'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Papa from 'papaparse'
import { useEffect, useMemo, useRef, useState } from 'react'
import { b2bAdminService } from 'services/b2bAdmin.service'

const INTERNATIONAL_COURIERS = ['FedEx', 'UPS', 'DHL', 'Self Network']

const normalize = (value) => String(value || '').trim().toLowerCase()
const displayCourierName = (name) => (name === 'UPS' ? 'UPS' : name)

const blankSlab = (zones) => ({
  minWeight: '',
  maxWeight: '',
  rates: Object.fromEntries(zones.map((zone) => [zone.code, ''])),
})

const ZoneHeading = ({ zone }) => (
  <HStack spacing={2} justify="center" whiteSpace="nowrap">
    <Text>ZONE {zone.code}</Text>
    <Tooltip
      label={`${zone.count || 0} destination(s) mapped to Zone ${zone.code}`}
      hasArrow
      placement="top"
    >
      <QuestionOutlineIcon color="gray.500" cursor="help" boxSize="14px" />
    </Tooltip>
  </HStack>
)

const buildInitialState = (zones, rates, courier) => {
  const courierRates = rates.filter((rate) => normalize(rate.deliveryPartner) === normalize(courier))
  const bySlab = new Map()
  const firstRate = courierRates[0] || {}

  courierRates.forEach((rate) => {
    const minWeight = rate.minWeight ?? rate.min_weight ?? '0'
    const maxWeight = rate.maxWeight ?? rate.max_weight ?? ''
    const key = `${minWeight}_${maxWeight}`
    const zoneCode = String(rate.destinationZone || rate.destination_zone || '').toUpperCase()
    const amount = rate.baseRate ?? rate.base_rate ?? rate.ratePerKg ?? rate.rate_per_kg ?? ''

    if (!bySlab.has(key)) {
      bySlab.set(key, {
        minWeight,
        maxWeight,
        rates: Object.fromEntries(zones.map((zone) => [zone.code, ''])),
      })
    }
    if (zoneCode) {
      bySlab.get(key).rates[zoneCode] = amount
    }
  })

  const slabs = [...bySlab.values()].sort((a, b) => Number(a.maxWeight) - Number(b.maxWeight))
  return {
    fuelSurchargeMode: firstRate.fuelSurchargeMode || firstRate.fuel_surcharge_mode || 'percentage',
    fuelSurchargeValue: firstRate.fuelSurchargeValue ?? firstRate.fuel_surcharge_value ?? '',
    slabs: slabs.length ? slabs : [blankSlab(zones)],
  }
}

const InternationalCourierRateForm = ({ courier, card, zones }) => {
  const [state, setState] = useState(() => buildInitialState(zones, card?.rates || [], courier))
  const fileRef = useRef()
  const toast = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    setState(buildInitialState(zones, card?.rates || [], courier))
  }, [card, courier, zones])

  const mutation = useMutation({
    mutationFn: (payload) => b2bAdminService.updateInternationalCourierRates(card.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['international-rate-cards'] })
      toast({
        title: 'International rates saved',
        description: `${data.saved || 0} zone rate row(s) updated for ${courier}.`,
        status: 'success',
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to save international rates',
        description: error?.response?.data?.error || error?.message || 'Please check the slab values.',
        status: 'error',
      })
    },
  })

  const updateSlab = (index, field, value, zoneCode) =>
    setState((current) => ({
      ...current,
      slabs: current.slabs.map((slab, slabIndex) =>
        slabIndex === index
          ? zoneCode
            ? { ...slab, rates: { ...slab.rates, [zoneCode]: value } }
            : { ...slab, [field]: value }
          : slab,
      ),
    }))
  const updateFuelSurcharge = (field, value) =>
    setState((current) => ({
      ...current,
      [field]: value,
    }))

  const save = () => {
    const slabs = state.slabs
      .map((slab) => ({
        minWeight: slab.minWeight,
        maxWeight: slab.maxWeight,
        rates: Object.fromEntries(
          zones
            .map((zone) => [zone.code, slab.rates?.[zone.code]])
            .filter(([, value]) => value !== '' && value !== null && value !== undefined),
        ),
      }))
      .filter((slab) => Object.keys(slab.rates).length)

    if (!slabs.length) {
      toast({ title: 'Add at least one zone rate', status: 'warning' })
      return
    }

    mutation.mutate({
      deliveryPartner: courier,
      currency: 'INR',
      estimatedDays: 'Manual quote',
      fuelSurchargeMode: state.fuelSurchargeMode || 'percentage',
      fuelSurchargeValue: state.fuelSurchargeValue || 0,
      slabs,
    })
  }

  const exportCsv = () => {
    const rows = state.slabs.map((slab) => ({
      fuel_surcharge_mode: state.fuelSurchargeMode || 'percentage',
      fuel_surcharge_value: state.fuelSurchargeValue || 0,
      min_weight: slab.minWeight,
      max_weight: slab.maxWeight,
      ...Object.fromEntries(zones.map((zone) => [`zone_${zone.code.toLowerCase()}`, slab.rates[zone.code]])),
    }))
    const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${courier.replace(/\s+/g, '-').toLowerCase()}-international-rates.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const importCsv = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const firstRow = data[0] || {}
        setState({
          fuelSurchargeMode: firstRow.fuel_surcharge_mode || firstRow.fuelSurchargeMode || 'percentage',
          fuelSurchargeValue: firstRow.fuel_surcharge_value ?? firstRow.fuelSurchargeValue ?? '',
          slabs: data.map((row) => ({
            minWeight: row.min_weight || '',
            maxWeight: row.max_weight || '',
            rates: Object.fromEntries(
              zones.map((zone) => [zone.code, row[`zone_${zone.code.toLowerCase()}`] || '']),
            ),
          })),
        })
        toast({ title: 'International courier rates imported', status: 'success' })
      },
    })
  }

  return (
    <Box py={3}>
      <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Text color="brand.400" fontSize="sm">
          Manage Rates
        </Text>
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="outline"
            colorScheme="brand"
            leftIcon={<AddIcon />}
            onClick={() =>
              setState((current) => ({
                ...current,
                slabs: [...current.slabs, blankSlab(zones)],
              }))
            }
          >
            Add New
          </Button>
          <Button size="sm" variant="outline" colorScheme="brand" onClick={exportCsv}>
            Export
          </Button>
          <Button size="sm" variant="outline" colorScheme="brand" onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <Button size="sm" colorScheme="brand" onClick={save} isLoading={mutation.isPending}>
            Submit
          </Button>
          <Input
            ref={fileRef}
            type="file"
            accept=".csv"
            display="none"
            onChange={(event) => event.target.files?.[0] && importCsv(event.target.files[0])}
          />
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <FormControl>
          <FormLabel fontSize="sm">Fuel Surcharge Type</FormLabel>
          <Select
            size="sm"
            value={state.fuelSurchargeMode || 'percentage'}
            onChange={(event) => updateFuelSurcharge('fuelSurchargeMode', event.target.value)}
          >
            <option value="percentage">Percentage (%)</option>
            <option value="flat">Flat Amount</option>
          </Select>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Percentage is calculated on base plus weight charge. Flat adds a fixed amount.
          </Text>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Fuel Surcharge Value</FormLabel>
          <Input
            size="sm"
            type="number"
            min="0"
            step="0.01"
            value={state.fuelSurchargeValue ?? ''}
            onChange={(event) => updateFuelSurcharge('fuelSurchargeValue', event.target.value)}
            placeholder={state.fuelSurchargeMode === 'flat' ? 'e.g. 250' : 'e.g. 12.5'}
          />
          <Text fontSize="xs" color="gray.500" mt={1}>
            Saved separately for {displayCourierName(courier)}.
          </Text>
        </FormControl>
      </SimpleGrid>

      <TableContainer border="1px solid" borderColor="gray.100">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Min Weight(kg)</Th>
              <Th>Max Weight(kg)</Th>
              {zones.map((zone) => (
                <Th key={zone.code}>
                  <ZoneHeading zone={zone} />
                </Th>
              ))}
              <Th>Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {state.slabs.map((slab, index) => (
              <Tr key={`${slab.minWeight}-${slab.maxWeight}-${index}`}>
                <Td>
                  <Input
                    size="sm"
                    type="number"
                    value={slab.minWeight}
                    onChange={(event) => updateSlab(index, 'minWeight', event.target.value)}
                  />
                </Td>
                <Td>
                  <Input
                    size="sm"
                    type="number"
                    value={slab.maxWeight}
                    onChange={(event) => updateSlab(index, 'maxWeight', event.target.value)}
                  />
                </Td>
                {zones.map((zone) => (
                  <Td key={zone.code}>
                    <Input
                      size="sm"
                      type="number"
                      value={slab.rates[zone.code] || ''}
                      onChange={(event) => updateSlab(index, null, event.target.value, zone.code)}
                    />
                  </Td>
                ))}
                <Td>
                  <Button
                    size="xs"
                    variant="link"
                    colorScheme="red"
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        slabs: current.slabs.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                  >
                    Delete
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  )
}

const InternationalRateCardWorkspace = ({ planName }) => {
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['international-rate-cards'],
    queryFn: b2bAdminService.getInternationalRateCards,
  })
  const [selectedCardId, setSelectedCardId] = useState('')

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === (selectedCardId || cards[0]?.id)) || cards[0],
    [cards, selectedCardId],
  )

  const zoneRows = useMemo(() => {
    const countries = selectedCard?.destinationCountries || []
    const grouped = new Map()
    for (const country of countries) {
      const zoneCode = String(country.zoneCode || '-').toUpperCase()
      if (!grouped.has(zoneCode)) grouped.set(zoneCode, [])
      grouped.get(zoneCode).push(country.countryName)
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true }))
      .map(([code, countryNames]) => ({
        code,
        name: `ZONE ${code}`,
        count: countryNames.length,
        preview: countryNames.slice(0, 8).join(', '),
      }))
  }, [selectedCard])

  const zones = useMemo(() => {
    const fromCountries = zoneRows.map((zone) => zone.code)
    const fromRates = (selectedCard?.destinationZones || []).map((zone) => String(zone).toUpperCase())
    const codes = [...new Set([...fromCountries, ...fromRates])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )
    return codes.map((code) => zoneRows.find((zone) => zone.code === code) || { code, name: `ZONE ${code}`, count: 0 })
  }, [selectedCard, zoneRows])

  if (isLoading) return <Spinner color="brand.500" />

  return (
    <Box>
      <Flex justify="space-between" gap={4} align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={5}>
        <Box>
          <Text fontWeight="800" fontSize="lg">{planName || 'International'} Rate Card</Text>
          <Text color="gray.500" fontSize="sm">
            Add manual international rates by courier and destination zone. Countries are mapped from the international zone sheet.
          </Text>
        </Box>
        <Select
          maxW={{ base: '100%', md: '360px' }}
          value={selectedCard?.id || ''}
          onChange={(event) => setSelectedCardId(event.target.value)}
        >
          {cards.map((card) => (
            <option key={card.id} value={card.id}>{card.name}</option>
          ))}
        </Select>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={5}>
        <Box border="1px solid" borderColor="gray.100" borderRadius="6px" p={4}>
          <Text color="gray.500" fontSize="xs" fontWeight="700" textTransform="uppercase">Couriers</Text>
          <HStack wrap="wrap" mt={3}>
            {INTERNATIONAL_COURIERS.map((courier) => (
              <Badge key={courier} colorScheme="purple" px={2} py={1}>{displayCourierName(courier)}</Badge>
            ))}
          </HStack>
        </Box>
        <Box border="1px solid" borderColor="gray.100" borderRadius="6px" p={4}>
          <Text color="gray.500" fontSize="xs" fontWeight="700" textTransform="uppercase">Zones</Text>
          <Text fontSize="2xl" fontWeight="800" mt={2}>{zones.length}</Text>
          <Text color="gray.500" fontSize="sm">International destination zones</Text>
        </Box>
        <Box border="1px solid" borderColor="gray.100" borderRadius="6px" p={4}>
          <Text color="gray.500" fontSize="xs" fontWeight="700" textTransform="uppercase">Destinations</Text>
          <Text fontSize="2xl" fontWeight="800" mt={2}>{selectedCard?.destinationCountries?.length || 0}</Text>
          <Text color="gray.500" fontSize="sm">Countries mapped from Sheet 2</Text>
        </Box>
      </SimpleGrid>

      <Accordion allowToggle defaultIndex={0}>
        {INTERNATIONAL_COURIERS.map((courier) => (
          <AccordionItem key={courier} mb={3} border="1px solid" borderColor="gray.100" bg="white">
            <AccordionButton px={4} py={4} _expanded={{ bg: 'gray.50' }}>
              <HStack flex="1" textAlign="left" spacing={3}>
                <Text fontWeight="700">{displayCourierName(courier)}</Text>
                <Text fontSize="xs" color="gray.500">{selectedCard?.name || 'International'} Rate Card</Text>
              </HStack>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel px={4} pb={5}>
              <InternationalCourierRateForm courier={courier} card={selectedCard} zones={zones} />
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>

      <TableContainer border="1px solid" borderColor="gray.100" borderRadius="6px" mt={5}>
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Zone</Th>
              <Th>Destination Count</Th>
              <Th>Mapped Destinations</Th>
            </Tr>
          </Thead>
          <Tbody>
            {zoneRows.map((row) => (
              <Tr key={row.code}>
                <Td fontWeight="800">{row.code}</Td>
                <Td>{row.count}</Td>
                <Td color="gray.600">{row.preview}{row.count > 8 ? '...' : ''}</Td>
              </Tr>
            ))}
            {!zoneRows.length && (
              <Tr>
                <Td colSpan={3} textAlign="center" py={8} color="gray.500">
                  No international zone mapping found. Run the international rate seed first.
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default InternationalRateCardWorkspace
