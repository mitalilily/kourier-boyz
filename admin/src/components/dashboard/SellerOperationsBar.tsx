import {
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import {
  hasAdminWorkspaceSession,
  openAdminWorkspace,
  rememberAdminWorkspacePath,
  type AdminWorkspace,
} from '../../config/adminWorkspace'

const openDirectory = (workspace: AdminWorkspace, path: string) => {
  rememberAdminWorkspacePath(workspace, path)
  openAdminWorkspace(workspace)
}

const SellerOperationsBar = () => {
  const marketplaceReady = hasAdminWorkspaceSession('marketplace')
  const logisticsReady = hasAdminWorkspaceSession('logistics')

  return (
    <section className="kb-seller-operations" aria-labelledby="seller-operations-title">
      <div className="kb-seller-operations-copy">
        <span className="kb-admin-eyebrow">One team, two seller journeys</span>
        <h2 id="seller-operations-title">Seller operations</h2>
        <p>
          Review commerce sellers and courier clients in their own operational context without
          losing your place.
        </p>
      </div>

      <div className="kb-seller-operations-actions">
        <button
          type="button"
          className="kb-seller-workspace-card is-marketplace"
          onClick={() => openDirectory('marketplace', '/sellers')}
        >
          <span className="kb-seller-workspace-icon" aria-hidden="true">
            <ShopOutlined />
          </span>
          <span className="kb-seller-workspace-content">
            <span className="kb-seller-workspace-kicker">
              <SafetyCertificateOutlined />
              {marketplaceReady ? 'Session ready' : 'Sign-in required'}
            </span>
            <strong>Marketplace sellers</strong>
            <small>KYC, catalogue, orders, returns and settlements</small>
          </span>
          <ArrowRightOutlined className="kb-seller-workspace-arrow" />
        </button>

        <button
          type="button"
          className="kb-seller-workspace-card is-logistics"
          onClick={() => openDirectory('logistics', '/logistics/admin/users-management')}
        >
          <span className="kb-seller-workspace-icon" aria-hidden="true">
            <TruckOutlined />
          </span>
          <span className="kb-seller-workspace-content">
            <span className="kb-seller-workspace-kicker">
              <SafetyCertificateOutlined />
              {logisticsReady ? 'Session ready' : 'Sign-in required'}
            </span>
            <strong>Courier clients</strong>
            <small>KYC, wallets, shipments, rate cards and support</small>
          </span>
          <ArrowRightOutlined className="kb-seller-workspace-arrow" />
        </button>
      </div>
    </section>
  )
}

export default SellerOperationsBar
