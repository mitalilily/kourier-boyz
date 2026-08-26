import {
  ArrowLeftOutlined,
  BarChartOutlined,
  HomeOutlined,
  ShopOutlined,
  TruckOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

type MarketplacePublicShellProps = {
  children: ReactNode
}

const navigation = [
  { label: 'Overview', icon: <HomeOutlined />, href: '/home' },
  { label: 'Shipments', icon: <TruckOutlined />, href: '/orders/list' },
  { label: 'Track order', icon: <BarChartOutlined />, href: '/tools/order_tracking' },
  { label: 'Marketplace', icon: <ShopOutlined />, href: '/store/', active: true },
  { label: 'Billing', icon: <WalletOutlined />, href: '/billing/invoice_management' },
]

/** Keeps the courier workflow visible while the seller is entering the marketplace. */
const MarketplacePublicShell = ({ children }: MarketplacePublicShellProps) => {
  return (
    <div className="kb-public-shell">
      <aside className="kb-public-shell-rail" aria-label="Courier Console navigation">
        <a className="kb-public-shell-brand" href="/home" aria-label="Back to Kourier Boyz courier console">
          <span className="kb-public-shell-mark">
            <img src="/store/brand/kourier-boyz-mark.png" alt="" />
          </span>
          <span>
            <strong>Kourier Boyz</strong>
            <small>Courier Console</small>
          </span>
        </a>

        <div className="kb-public-shell-label">Workspace</div>
        <nav className="kb-public-shell-nav">
          {navigation.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={item.active ? 'is-active' : undefined}
              aria-current={item.active ? 'page' : undefined}
            >
              <span className="kb-public-shell-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.active && <i aria-hidden="true" />}
            </a>
          ))}
        </nav>

        <div className="kb-public-shell-rail-footer">
          <span className="kb-public-shell-live-dot" />
          <span>One connected workspace</span>
        </div>
      </aside>

      <div className="kb-public-shell-content">
        <div className="kb-public-shell-context">
          <a href="/home">
            <ArrowLeftOutlined />
            Back to Courier Console
          </a>
          <span>
            <TruckOutlined /> Shipping and selling, together
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

export default MarketplacePublicShell
