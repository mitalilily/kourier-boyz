import {
  Box,
  Button,
  Card,
  CardContent,
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
import { useEffect, useMemo, useState } from 'react'
import { calculateInternationalRate, fetchInternationalRateCards } from '../../api/international.api'
import { toast } from '../../components/UI/Toast'
import ListPageLayout from '../../components/UI/layout/ListPageLayout'

export default function InternationalRateCalculator() {
  const [rateCards, setRateCards] = useState<any[]>([])
  const [form, setForm] = useState({
    rateCardId: '',
    deliveryPartner: '',
    originZone: '',
    weight: '1.000',
    destinationCity: '',
    destinationState: '',
    destinationCountry: '',
  })
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const selectedCard = useMemo(() => rateCards.find((card) => card.id === form.rateCardId), [rateCards, form.rateCardId])
  const destinationCountries = selectedCard?.destinationCountries ?? []

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const cards = await fetchInternationalRateCards()
        setRateCards(cards)
        if (cards[0]) {
          setForm((prev) => ({
            ...prev,
            rateCardId: cards[0].id,
            originZone: cards[0].originZone,
            destinationCountry: cards[0]?.destinationCountries?.[0]?.countryName || prev.destinationCountry,
          }))
        }
      } catch (error: any) {
        toast.open({ message: error?.response?.data?.error || 'Failed to load international rate cards', severity: 'error' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const updateCard = (rateCardId: string) => {
    const card = rateCards.find((item) => item.id === rateCardId)
    setForm((prev) => ({
      ...prev,
      rateCardId,
      deliveryPartner: '',
      originZone: card?.originZone || '',
      destinationCountry: card?.destinationCountries?.[0]?.countryName || '',
    }))
  }

  const calculate = async () => {
    setCalculating(true)
    try {
      setResults(await calculateInternationalRate(form))
    } catch (error: any) {
      setResults([])
      toast.open({ message: error?.response?.data?.error || 'Rate calculation failed', severity: 'error' })
    } finally {
      setCalculating(false)
    }
  }

  return (
    <ListPageLayout title="International Rate Calculator" description="Calculate available international shipment rates before creating a manual booking request.">
      <Stack spacing={2}>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
              <TextField select size="small" label="Rate Card" value={form.rateCardId} onChange={(e) => updateCard(e.target.value)} disabled={loading}>
                {rateCards.map((card) => <MenuItem key={card.id} value={card.id}>{card.name}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Delivery Partner (optional)" value={form.deliveryPartner} onChange={(e) => setForm({ ...form, deliveryPartner: e.target.value })}>
                <MenuItem value="">All partners</MenuItem>
                {selectedCard?.deliveryPartners?.map((partner: string) => <MenuItem key={partner} value={partner}>{partner}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Origin Zone" value={form.originZone} InputProps={{ readOnly: true }} />
              <TextField size="small" type="number" label="Weight (kg)" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              <TextField size="small" label="Destination City" value={form.destinationCity} onChange={(e) => setForm({ ...form, destinationCity: e.target.value })} />
              <TextField size="small" label="Destination State" value={form.destinationState} onChange={(e) => setForm({ ...form, destinationState: e.target.value })} />
              <TextField select size="small" label="Destination Country" value={form.destinationCountry} onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })}>
                {destinationCountries.map((country: any) => (
                  <MenuItem key={country.countryKey || country.countryName} value={country.countryName}>
                    {country.countryName} {country.zoneCode ? `(Zone ${country.zoneCode})` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Button variant="contained" onClick={calculate} disabled={!form.rateCardId || calculating} sx={{ mt: 2, textTransform: 'none', borderRadius: 2 }}>
              {calculating ? 'Calculating...' : 'Calculate Rate'}
            </Button>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Rate Results</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>Partner</TableCell><TableCell>Rate Card</TableCell><TableCell>Zone</TableCell><TableCell>Weight</TableCell><TableCell>Rate/kg</TableCell><TableCell>Fuel Surcharge</TableCell><TableCell>Total</TableCell><TableCell>ETA</TableCell></TableRow></TableHead>
                <TableBody>
                  {results.length ? results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>{result.deliveryPartner}</TableCell>
                      <TableCell>{result.rateCard}</TableCell>
                      <TableCell>{result.destinationZone || '-'}</TableCell>
                      <TableCell>{Number(result.weight).toFixed(3)} kg</TableCell>
                      <TableCell>{result.currency} {Number(result.ratePerKg).toFixed(2)}</TableCell>
                      <TableCell>
                        {result.currency} {Number(result.fuelSurcharge || 0).toFixed(2)}
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                          {result.fuelSurchargeMode === 'flat'
                            ? 'Flat'
                            : `${Number(result.fuelSurchargeValue || 0).toFixed(2)}%`}
                        </Typography>
                      </TableCell>
                      <TableCell>{result.currency} {Number(result.total).toFixed(2)}</TableCell>
                      <TableCell>{result.estimatedDays || '—'}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={8} align="center">Calculate to see rates</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </ListPageLayout>
  )
}
