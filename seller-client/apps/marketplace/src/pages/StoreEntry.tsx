import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ShopOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import MarketplacePublicShell from '../components/MarketplacePublicShell'
import { logisticsConsoleUrl } from '../api/runtime'

const benefits = [
  'List products and control inventory',
  'Process marketplace orders and returns',
  'Fulfil every marketplace order through your verified shipping account',
]

const StoreEntry = () => {
  return (
    <MarketplacePublicShell>
      <main className="kb-store-entry-page">
      <section className="kb-store-entry-hero">
        <img
          className="kb-store-entry-image"
          src="/store/brand/marketplace-seller-journey.png"
          alt="Products moving from an online catalogue through packing and delivery"
        />
        <div className="kb-store-entry-shade" />

        <div className="kb-store-entry-copy">
          <span className="kb-store-entry-kicker">Kourier Boyz Marketplace</span>
          <div className="kb-store-entry-route">
            <span>Sell</span>
            <i />
            <span>Ship</span>
            <i />
            <span>Grow</span>
          </div>
          <h1>Open your store. Ship what sells.</h1>
          <p>
            Put your catalogue, customer orders, and delivery workflow in one clear seller workspace.
            Your courier account is the secure business identity behind the store, so verification,
            pickup, tracking, and fulfilment stay connected from the start.
          </p>

          <div className="kb-store-entry-benefits">
            {benefits.map((benefit) => (
              <span key={benefit}>
                <CheckCircleFilled />
                {benefit}
              </span>
            ))}
          </div>

          <div className="kb-store-entry-actions">
            <a href={`${logisticsConsoleUrl}/?intent=marketplace`}>
              <Button type="primary" size="large" icon={<ShopOutlined />}>
                Continue with Kourier Boyz <ArrowRightOutlined />
              </Button>
            </a>
            <a href={`${logisticsConsoleUrl}/?intent=shipping`} className="kb-store-entry-inline-link">Ship without opening a store</a>
          </div>
        </div>

        <div className="kb-store-entry-proof" aria-label="Seller workspace capabilities">
          {[
            ['01', 'Create', 'Build a professional catalogue'],
            ['02', 'Sell', 'Manage orders and customers'],
            ['03', 'Deliver', 'Fulfil through your courier account'],
          ].map(([number, title, detail]) => (
            <div key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
      </section>
      </main>
    </MarketplacePublicShell>
  )
}

export default StoreEntry
