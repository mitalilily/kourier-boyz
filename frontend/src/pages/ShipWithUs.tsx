import { ArrowRight, Boxes, Check, FileText, PackagePlus, Truck, Upload, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSellerPanelUrl } from '@/lib/sellerPanelUrl'

const ShipWithUs = () => {
  const sellerUrl = getSellerPanelUrl('/')

  return (
    <main className="kb-site min-h-screen bg-white pt-28 lg:pt-24">
      <section className="relative min-h-[620px] overflow-hidden border-b border-black/10">
        <img src="/brand/kourier-boyz-hero.webp" alt="Delivery truck prepared for pickup" className="absolute inset-0 h-full w-full object-cover object-[68%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,0.97)_38%,rgba(255,255,255,0.2)_70%)]" />
        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-5 py-16 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <div className="kb-eyebrow"><Truck className="h-4 w-4" /> Courier aggregation</div>
            <h1 className="mt-6 text-5xl font-black leading-[1.04] sm:text-6xl">Every order deserves a dependable way forward.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#555]">Ship orders from your website, social channels, shop counter, or the Kourier Boyz marketplace. Compare options and manage the complete dispatch from one seller account.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href={sellerUrl} className="kb-button kb-button-gold">Open seller panel <ArrowRight className="h-5 w-5" /></a>
              <Link to="/rates" className="kb-button kb-button-outline">Check shipping rates</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="kb-section kb-metal-pattern">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="kb-kicker">A straightforward dispatch</span>
              <h2 className="kb-title mt-3">From order details to ready-for-pickup in four steps.</h2>
              <p className="kb-copy mt-4">The seller panel keeps operational work clear, whether you create one parcel or upload an entire day of orders.</p>
            </div>
            <div className="kb-panel divide-y divide-black/10">
              {[
                [PackagePlus, 'Add the order', 'Enter customer, parcel, and payment details.'],
                [Truck, 'Choose the service', 'Compare available courier options by price and delivery estimate.'],
                [FileText, 'Prepare the parcel', 'Generate the AWB and print a shipping label.'],
                [WalletCards, 'Follow the money', 'Track delivery charges and COD remittance.'],
              ].map(([Icon, title, copy], index) => (
                <div key={title as string} className="grid gap-4 p-5 sm:grid-cols-[42px_44px_1fr] sm:items-center sm:p-6">
                  <span className="text-sm font-black text-[#a9730c]">0{index + 1}</span>
                  <Icon className="h-9 w-9 border border-black/10 bg-[#f4f3ef] p-2 text-[#a9730c]" />
                  <div><h3 className="font-black">{title as string}</h3><p className="mt-1 text-sm leading-6 text-[#666]">{copy as string}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="kb-section bg-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-3xl"><span className="kb-kicker">Designed for the way you sell</span><h2 className="kb-title mt-3">One shipping desk, three practical workflows.</h2></div>
          <div className="mt-10 grid border border-black/10 md:grid-cols-3">
            {[
              [Boxes, 'Single shipments', 'Create parcels for direct, retail, social, or replacement orders.'],
              [Upload, 'Bulk dispatch', 'Upload multiple orders and prepare labels together.'],
              [Truck, 'Marketplace fulfilment', 'Move Kourier Boyz marketplace orders straight into shipping.'],
            ].map(([Icon, title, copy], index) => (
              <div key={title as string} className={`p-7 ${index ? 'border-t border-black/10 md:border-l md:border-t-0' : ''}`}>
                <Icon className="h-9 w-9 text-[#a9730c]" /><h3 className="mt-6 text-xl font-black">{title as string}</h3><p className="mt-3 leading-7 text-[#606060]">{copy as string}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-black/10 pt-7 text-sm font-bold">
            {['No marketplace store required', 'COD and prepaid orders', 'Shared buyer tracking', 'Store can be enabled later'].map((item) => <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#b78115]" />{item}</span>)}
          </div>
        </div>
      </section>
    </main>
  )
}

export default ShipWithUs
