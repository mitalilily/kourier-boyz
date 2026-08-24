import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
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
  Tr,
  useToast,
} from '@chakra-ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { b2bAdminService } from 'services/b2bAdmin.service'

const InternationalRateCalculator = () => {
  const [form, setForm] = useState({
    rateCardId: '',
    deliveryPartner: '',
    originZone: '',
    weight: '1.000',
    destinationCity: '',
    destinationState: '',
    destinationCountry: '',
  })
  const [results, setResults] = useState([])
  const toast = useToast()
  const { data: rateCards = [], isLoading } = useQuery({
    queryKey: ['international-rate-cards'],
    queryFn: b2bAdminService.getInternationalRateCards,
  })
  const selectedCard = useMemo(
    () => rateCards.find((card) => card.id === form.rateCardId),
    [rateCards, form.rateCardId],
  )
  const destinationCountries = selectedCard?.destinationCountries ?? []

  useEffect(() => {
    if (!rateCards.length) return
    setForm((current) =>
      current.rateCardId
        ? current
        : {
            ...current,
            rateCardId: rateCards[0].id,
            originZone: rateCards[0].originZone,
            destinationCountry: rateCards[0]?.destinationCountries?.[0]?.countryName || '',
          },
    )
  }, [rateCards])

  const calculate = useMutation({
    mutationFn: b2bAdminService.calculateInternationalRate,
    onSuccess: setResults,
    onError: (error) => {
      setResults([])
      toast({
        title: 'Rate calculation failed',
        description: error.response?.data?.error || error.message,
        status: 'error',
      })
    },
  })

  const updateCard = (rateCardId) => {
    const card = rateCards.find((item) => item.id === rateCardId)
    setForm((current) => ({
      ...current,
      rateCardId,
      deliveryPartner: '',
      originZone: card?.originZone || '',
      destinationCountry: card?.destinationCountries?.[0]?.countryName || '',
    }))
  }

  return (
    <Box pt={{ base: '110px', md: '86px' }}>
      <Box mb={6}>
        <Heading size="md">Int Rate Calculator</Heading>
        <Text mt={2} fontSize="sm">
          <Text as="span" color="brand.500">
            Dashboard
          </Text>{' '}
          &gt; Int Rate Calculator
        </Text>
      </Box>

      <Box bg="white" border="1px solid" borderColor="gray.100" borderRadius="6px">
        <Heading size="sm" px={4} py={5} borderBottom="1px solid" borderColor="gray.100">
          Int Rate Calculator
        </Heading>
        <Box p={4}>
          {isLoading ? (
            <Spinner color="brand.500" />
          ) : (
            <>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5}>
                <FormControl isRequired>
                  <FormLabel>Rate Card</FormLabel>
                  <Select value={form.rateCardId} onChange={(event) => updateCard(event.target.value)}>
                    {rateCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name} (#{card.id.slice(0, 4).toUpperCase()})
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Delivery Partner (optional)</FormLabel>
                  <Select
                    placeholder="All partners"
                    value={form.deliveryPartner}
                    onChange={(event) => setForm({ ...form, deliveryPartner: event.target.value })}
                  >
                    {selectedCard?.deliveryPartners?.map((partner) => (
                      <option key={partner} value={partner}>
                        {partner}
                      </option>
                    ))}
                  </Select>
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Leave empty to quote all partners.
                  </Text>
                </FormControl>
                <FormControl>
                  <FormLabel>Origin Zone</FormLabel>
                  <Input value={form.originZone} isReadOnly />
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 4 }} spacing={5} mt={6}>
                <FormControl isRequired>
                  <FormLabel>Weight (kg)</FormLabel>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={form.weight}
                    onChange={(event) => setForm({ ...form, weight: event.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Dest City</FormLabel>
                  <Input
                    placeholder="e.g. Mumbai"
                    value={form.destinationCity}
                    onChange={(event) => setForm({ ...form, destinationCity: event.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Dest State</FormLabel>
                  <Input
                    placeholder="e.g. Maharashtra"
                    value={form.destinationState}
                    onChange={(event) => setForm({ ...form, destinationState: event.target.value })}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Dest Country</FormLabel>
                  <Select
                    value={form.destinationCountry}
                    onChange={(event) => setForm({ ...form, destinationCountry: event.target.value })}
                  >
                    {destinationCountries.map((country) => (
                      <option key={country.countryKey || country.countryName} value={country.countryName}>
                        {country.countryName} {country.zoneCode ? `(Zone ${country.zoneCode})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>

              <Button
                mt={8}
                colorScheme="brand"
                isLoading={calculate.isPending}
                onClick={() => calculate.mutate(form)}
                isDisabled={!form.rateCardId || !form.destinationCountry}
              >
                Calculate
              </Button>
            </>
          )}
        </Box>
      </Box>

      {results.length > 0 && (
        <Box mt={5} bg="white" border="1px solid" borderColor="gray.100" borderRadius="6px" p={4}>
          <TableContainer>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Delivery Partner</Th>
                  <Th>Rate Card</Th>
                  <Th>Zone</Th>
                  <Th>Weight</Th>
                  <Th>Rate / Kg</Th>
                  <Th>Base Rate</Th>
                  <Th>Fuel Surcharge</Th>
                  <Th>Total</Th>
                  <Th>Estimated Delivery</Th>
                </Tr>
              </Thead>
              <Tbody>
                {results.map((result) => (
                  <Tr key={result.id}>
                    <Td fontWeight="700">{result.deliveryPartner}</Td>
                    <Td>{result.rateCard}</Td>
                    <Td>{result.destinationZone || '-'}</Td>
                    <Td>{result.weight.toFixed(3)} kg</Td>
                    <Td>
                      {result.currency} {result.ratePerKg.toFixed(2)}
                    </Td>
                    <Td>
                      {result.currency} {result.baseRate.toFixed(2)}
                    </Td>
                    <Td>
                      {result.currency} {(result.fuelSurcharge || 0).toFixed(2)}
                      <Text fontSize="xs" color="gray.400">
                        {result.fuelSurchargeMode === 'flat'
                          ? 'Flat'
                          : `${Number(result.fuelSurchargeValue || 0).toFixed(2)}%`}
                      </Text>
                    </Td>
                    <Td fontWeight="800" color="brand.500">
                      {result.currency} {result.total.toFixed(2)}
                    </Td>
                    <Td>{result.estimatedDays || '-'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  )
}

export default InternationalRateCalculator
