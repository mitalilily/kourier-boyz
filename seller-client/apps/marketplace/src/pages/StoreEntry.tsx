import { ArrowRightOutlined, LoginOutlined, SafetyCertificateOutlined, ShopOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router-dom'

const benefits = [
  'Publish products to the Kourier Boyz marketplace',
  'Manage catalogue, inventory, orders, and returns',
  'Connect fulfilment to the courier workspace when you choose',
]

const StoreEntry = () => (
  <main className="kb-store-entry-page">
    <section className="kb-store-entry-panel">
      <div className="kb-store-entry-copy">
        <span className="kb-store-entry-kicker">Marketplace seller tools</span>
        <h1>Turn your catalogue into a storefront customers can trust.</h1>
        <p>
          Shipping remains available on its own. Open a marketplace store only when it is useful for
          your business, then manage selling and fulfilment from the same Kourier Boyz platform.
        </p>
        <div className="kb-store-entry-benefits">
          {benefits.map((benefit) => (
            <span key={benefit}>
              <SafetyCertificateOutlined />
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
          <Link to="/login">
            <Button size="large" icon={<LoginOutlined />}>
              Seller sign in
            </Button>
          </Link>
        </div>
      </div>
      <aside className="kb-store-entry-preview" aria-label="Marketplace seller preview">
        <div className="kb-store-preview-header">
          <img src="/store/brand/kourier-boyz-logo.png" alt="Kourier Boyz" />
          <span>Seller workspace</span>
        </div>
        <div className="kb-store-preview-metric">
          <small>Store readiness</small>
          <strong>Everything in one place</strong>
          <p>Catalogue, stock, marketplace orders, delivery, returns, and settlements.</p>
        </div>
        <div className="kb-store-preview-grid">
          {['Products', 'Inventory', 'Orders', 'Storefront'].map((label, index) => (
            <div key={label}>
              <span>0{index + 1}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </aside>
    </section>
  </main>
)

export default StoreEntry
