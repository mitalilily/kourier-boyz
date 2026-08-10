import { Calculator, IndianRupee, Package, ShieldCheck, Truck } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'

const RateCalculator = () => {
  const [fromPin, setFromPin] = useState('110001')
  const [toPin, setToPin] = useState('560001')
  const [weight, setWeight] = useState('1')
  const [cod, setCod] = useState(false)
  const [submitted, setSubmitted] = useState(true)

  const rates = useMemo(() => {
    const kg = Math.max(Number(weight) || 1, 0.5)
    const zone = fromPin.slice(0, 1) === toPin.slice(0, 1) ? 1 : 1.35
    const codCharge = cod ? 45 : 0
    return [
      { name: 'Express', eta: '1-2 business days', price: Math.round((155 + kg * 42) * zone + codCharge), note: 'Earliest delivery' },
      { name: 'Standard', eta: '3-5 business days', price: Math.round((105 + kg * 32) * zone + codCharge), note: 'Balanced choice' },
      { name: 'Economy', eta: '5-7 business days', price: Math.round((75 + kg * 24) * zone + codCharge), note: 'Lowest estimate' },
    ]
  }, [cod, fromPin, toPin, weight])

  const handleSubmit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true) }

  return (
    <main className="kb-site min-h-screen bg-white pb-20 pt-36 lg:pt-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <div className="kb-eyebrow"><Calculator className="h-4 w-4" /> Shipping estimate</div>
            <h1 className="mt-6 text-5xl font-black leading-[1.04] sm:text-6xl">Know the likely cost before you dispatch.</h1>
            <p className="mt-5 text-lg leading-8 text-[#606060]">Enter your route, weight, and payment type to compare sample service levels. Final availability is confirmed when a shipment is booked.</p>
            <div className="mt-8 border-l-2 border-[#b78115] pl-4 text-sm leading-6 text-[#606060]">These preview estimates keep the calculator usable while live courier rate integrations are connected.</div>
          </div>

          <div className="kb-panel overflow-hidden">
            <form onSubmit={handleSubmit} className="kb-metal-pattern border-b border-black/10 p-5 sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-black">Pickup pincode</span><input value={fromPin} onChange={(e) => setFromPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="kb-field" inputMode="numeric" /></label>
                <label><span className="mb-2 block text-sm font-black">Delivery pincode</span><input value={toPin} onChange={(e) => setToPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="kb-field" inputMode="numeric" /></label>
                <label><span className="mb-2 block text-sm font-black">Chargeable weight (kg)</span><input value={weight} onChange={(e) => setWeight(e.target.value)} className="kb-field" inputMode="decimal" /></label>
                <label className="flex min-h-[78px] items-end"><span className="flex h-[52px] w-full items-center justify-between border border-black/15 bg-white px-4 text-sm font-black">Cash on delivery<input checked={cod} onChange={(e) => setCod(e.target.checked)} type="checkbox" className="h-5 w-5 accent-[#b78115]" /></span></label>
              </div>
              <button className="kb-button kb-button-ink mt-5 w-full sm:w-auto">Calculate estimate <IndianRupee className="h-4 w-4" /></button>
            </form>

            <div className="p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-2xl font-black">Available service levels</h2><p className="mt-1 text-sm text-[#666]">Estimated charges for the entered parcel.</p></div><Package className="h-9 w-9 text-[#a9730c]" /></div>
              {submitted && <div className="divide-y divide-black/10 border border-black/10">
                {rates.map((rate, index) => (
                  <div key={rate.name} className="grid gap-4 p-5 sm:grid-cols-[48px_1fr_auto] sm:items-center">
                    <span className={`flex h-11 w-11 items-center justify-center ${index === 1 ? 'bg-[#b78115] text-white' : 'bg-[#efefec] text-[#8a620d]'}`}><Truck className="h-5 w-5" /></span>
                    <div><div className="flex flex-wrap items-center gap-3"><span className="font-black">{rate.name}</span><span className="text-xs font-bold uppercase text-[#8a620d]">{rate.note}</span></div><p className="mt-1 text-sm text-[#666]">{rate.eta}</p></div>
                    <div className="text-2xl font-black">Rs. {rate.price}</div>
                  </div>
                ))}
              </div>}
              <div className="mt-5 flex items-start gap-3 bg-[#f5f4ef] p-4 text-sm leading-6 text-[#555]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#a9730c]" />Rates can vary with exact dimensions, remote-area charges, declared value, and courier serviceability.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default RateCalculator
