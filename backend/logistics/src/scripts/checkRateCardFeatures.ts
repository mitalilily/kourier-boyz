import { pool } from '../models/client'
import { createHoliday, deleteHoliday } from '../models/services/holiday.service'
import { calculateInternationalRate, listInternationalRateCards } from '../models/services/internationalRate.service'
import {
  createAdditionalChargeMaster,
  createDieselRate,
  deleteAdditionalChargeMaster,
  deleteDieselRate,
  updateAdditionalChargeMaster,
  updateDieselRate,
} from '../models/services/rateCardMasters.service'

const run = async () => {
  const marker = Date.now()
  let chargeId: string | undefined
  let dieselId: string | undefined
  let holidayId: string | undefined
  try {
    const charge = await createAdditionalChargeMaster({ name: `Verification Charge ${marker}`, defaultMode: 'flat', defaultBasis: 'shipment' })
    chargeId = charge.id
    const updatedCharge = await updateAdditionalChargeMaster(charge.id, { description: 'Verified' })
    if (updatedCharge.description !== 'Verified') throw new Error('Additional charge update failed')

    const diesel = await createDieselRate({ dieselRate: '99.25', effectiveDate: '2026-07-15', remarks: 'Verification' })
    dieselId = diesel.id
    const updatedDiesel = await updateDieselRate(diesel.id, { dieselRate: '100.50' })
    if (Number(updatedDiesel.dieselRate) !== 100.5) throw new Error('Diesel rate update failed')

    const holiday = await createHoliday({ name: `Verification Holiday ${marker}`, date: '2026-12-31', type: 'national', isActive: true })
    holidayId = holiday.id

    const cards = await listInternationalRateCards()
    if (!cards.length) throw new Error('No international rate card was seeded')
    const quotes = await calculateInternationalRate({ rateCardId: cards[0].id, originZone: cards[0].originZone, destinationCountry: 'AF', weight: 1 })
    if (!quotes.length || quotes.some((quote) => quote.total <= 0)) throw new Error('International quote failed')

    console.log(`Rate Card features verified: ${quotes.length} international quotes returned`)
  } finally {
    if (chargeId) await deleteAdditionalChargeMaster(chargeId)
    if (dieselId) await deleteDieselRate(dieselId)
    if (holidayId) await deleteHoliday(holidayId)
    await pool.end()
  }
}

run().catch((error) => { console.error('Rate Card feature verification failed:', error); process.exitCode = 1 })
