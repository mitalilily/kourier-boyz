import {
  ArrowRightOutlined,
  CheckCircleFilled,
  EyeOutlined,
  LoginOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import MarketplacePublicShell from '../components/MarketplacePublicShell'
import { useAuthStore } from '../store/authStore'

const benefits = [
  'List products and control inventory',
  'Process marketplace orders and returns',
  'Use Kourier Boyz fulfilment when it suits you',
]

const StoreEntry = () => {
  const navigate = useNavigate()
  const startDemo = useAuthStore((state) => state.startDemo)

  const handleDemo = () => {
    startDemo()
    navigate('/dashboard')
  }

  return (
    <MarketplacePublicShell>
      <main className="kb-store-entry-page">
      <header className="kb-store-entry-nav">
        <img src="/store/brand/kourier-boyz-logo-transparent.png" alt="Kourier Boyz" />
        <Link to="/login" className="kb-store-entry-signin">
          <LoginOutlined /> Seller sign in
        </Link>
      </header>

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
            Sell through the marketplace when you want to, and choose Kourier Boyz fulfilment only
            when it helps your business move faster.
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
            <Link to="/register">
              <Button type="primary" size="large" icon={<ShopOutlined />}>
                Open your store <ArrowRightOutlined />
              </Button>
            </Link>
            <Button size="large" icon={<EyeOutlined />} onClick={handleDemo}>
              Preview seller workspace
            </Button>
          </div>
        </div>

        <div className="kb-store-entry-proof" aria-label="Seller workspace capabilities">
          {[
            ['01', 'Create', 'Build a professional catalogue'],
            ['02', 'Sell', 'Manage orders and customers'],
            ['03', 'Deliver', 'Book fulfilment when needed'],
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
