import API from '@/lib/axios'
import { ArrowRight, CheckCircle2, Clock3, MapPin, PackageSearch, Search, ShieldCheck, Truck } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

interface TrackingEvent { status?: string; message?: string; location?: string; timestamp?: string | Date }
interface TrackingResult {
  order?: { orderNumber?: string; status?: string }
  shipment?: { awb?: string; status?: string; courier?: string; trackingEvents?: TrackingEvent[] }
  kourierBoyzLogistics?: { status?: string; current_location?: string; estimated_delivery?: string; tracking_events?: TrackingEvent[] } | null
}

const TrackShipment = () => {
  const [searchParams] = useSearchParams()
  const [trackingId, setTrackingId] = useState(searchParams.get('awb') || '')
  const [result, setResult] = useState<TrackingResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const events = [...(result?.kourierBoyzLogistics?.tracking_events || []), ...(result?.shipment?.trackingEvents || [])]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())

  const handleTrack = async (event: FormEvent) => {
    event.preventDefault()
    if (!trackingId.trim()) { setError('Enter an AWB number or order number.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const response = await API.get(`/tracking/${encodeURIComponent(trackingId.trim())}`)
      setResult(response.data?.data || response.data)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No tracking details found for this ID.')
    } finally { setLoading(false) }
  }

  return (
    <main className="kb-site kb-metal-pattern min-h-screen px-5 pb-20 pt-36 sm:px-8 lg:px-10 lg:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <div className="kb-eyebrow"><PackageSearch className="h-4 w-4" /> Shipment tracking</div>
            <h1 className="mt-6 text-5xl font-black leading-[1.04] text-[#191919] sm:text-6xl">Follow your parcel from pickup to doorstep.</h1>
            <p className="mt-5 text-lg leading-8 text-[#606060]">Use the AWB printed on your label or the order number from your confirmation to view the latest available movement.</p>
            <form onSubmit={handleTrack} className="kb-panel mt-8 p-5">
              <label className="text-sm font-black text-[#333]">AWB or order number</label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="flex h-[52px] flex-1 items-center gap-3 border border-black/20 bg-white px-4 focus-within:border-[#b78115]">
                  <Search className="h-5 w-5 text-[#a9730c]" />
                  <input value={trackingId} onChange={(event) => setTrackingId(event.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="KB123456789IN" />
                </div>
                <button className="kb-button kb-button-ink">{loading ? 'Checking...' : 'Track parcel'}<ArrowRight className="h-4 w-4" /></button>
              </div>
              {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
            </form>
            <div className="mt-6 flex items-start gap-3 border-l-2 border-[#b78115] pl-4 text-sm leading-6 text-[#606060]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#a9730c]" />Marketplace orders and courier-only shipments use the same tracking page.</div>
          </div>

          <div className="kb-panel p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-black/10 pb-5">
              <div><h2 className="text-2xl font-black">Shipment movement</h2><p className="mt-1 text-sm text-[#666]">The newest confirmed checkpoint appears first.</p></div>
              <Truck className="h-10 w-10 bg-[#f0eee7] p-2 text-[#a9730c]" />
            </div>

            {result ? (
              <div className="pt-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="border border-black/10 bg-[#f7f7f4] p-4"><div className="text-xs font-bold text-[#666]">Order</div><div className="mt-1 font-black">{result.order?.orderNumber || trackingId}</div></div>
                  <div className="border border-black/10 bg-[#f7f7f4] p-4"><div className="text-xs font-bold text-[#666]">AWB</div><div className="mt-1 font-black">{result.shipment?.awb || trackingId}</div></div>
                  <div className="border border-[#d4ba80] bg-[#f8f1df] p-4"><div className="text-xs font-bold text-[#8a620d]">Status</div><div className="mt-1 font-black capitalize">{(result.kourierBoyzLogistics?.status || result.shipment?.status || result.order?.status || 'Pending').replace(/_/g, ' ')}</div></div>
                </div>
                <div className="mt-7 space-y-4">
                  {(events.length ? events : [{ status: result.shipment?.status || result.order?.status || 'Order received', message: 'Tracking updates will appear as the shipment moves.', timestamp: new Date() }]).map((item, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center"><CheckCircle2 className="h-6 w-6 text-[#b78115]" />{index < events.length - 1 && <div className="mt-2 h-full w-px bg-black/15" />}</div>
                      <div className="pb-4"><div className="font-black capitalize">{(item.message || item.status || 'Update').replace(/_/g, ' ')}</div><div className="mt-1 flex flex-wrap gap-3 text-sm text-[#666]">{item.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{item.location}</span>}<span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{new Date(item.timestamp || Date.now()).toLocaleString()}</span></div></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center bg-[#f4f4f1] text-center"><div><PackageSearch className="mx-auto h-14 w-14 text-[#b9b7af]" /><p className="mt-4 font-bold text-[#666]">Enter an ID to see shipment progress.</p></div></div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default TrackShipment
