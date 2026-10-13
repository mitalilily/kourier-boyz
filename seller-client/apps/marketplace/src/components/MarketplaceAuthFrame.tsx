import { SafetyOutlined, ShopOutlined, TruckOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import MarketplacePublicShell from './MarketplacePublicShell'

type MarketplaceAuthFrameProps = {
  children: ReactNode
  eyebrow: string
  title: string
  description: string
}

const MarketplaceAuthFrame = ({
  children,
  eyebrow,
  title,
  description,
}: MarketplaceAuthFrameProps) => {
  return (
    <MarketplacePublicShell>
      <main className="kb-seller-auth">
        <section className="kb-seller-auth-story" aria-label="Kourier Boyz seller platform">
          <div className="kb-seller-auth-story-inner">
            <img
              src="/store/brand/kourier-boyz-logo-transparent.png"
              alt="Kourier Boyz"
              className="kb-seller-auth-logo"
            />
            <div className="kb-seller-auth-copy">
              <span>{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="kb-seller-auth-capabilities">
              <div><ShopOutlined /><span>Sell</span></div>
              <div><TruckOutlined /><span>Ship</span></div>
              <div><SafetyOutlined /><span>Operate securely</span></div>
            </div>
          </div>
        </section>

        <section className="kb-seller-auth-form">
          <div className="kb-seller-auth-form-inner">
            <img
              src="/store/brand/kourier-boyz-logo-transparent.png"
              alt="Kourier Boyz"
              className="kb-seller-auth-mobile-logo"
            />
            {children}
            <p className="kb-seller-auth-copyright">
              &copy; {new Date().getFullYear()} Kourier Boyz. All rights reserved.
            </p>
          </div>
        </section>
      </main>
    </MarketplacePublicShell>
  )
}

export default MarketplaceAuthFrame
