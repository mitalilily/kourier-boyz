import type { ReactNode } from 'react'
import CourierSidebar from '../../../logistics/src/components/UI/Sidebar'

type MarketplacePublicShellProps = {
  children: ReactNode
}

/** Reuses the courier app's real navigation during the marketplace handoff. */
const MarketplacePublicShell = ({ children }: MarketplacePublicShellProps) => {
  return (
    <div className="kb-public-shell">
      <CourierSidebar role="customer" pinned={false} externalNavigation />
      <div className="kb-public-shell-content">{children}</div>
    </div>
  )
}

export default MarketplacePublicShell
