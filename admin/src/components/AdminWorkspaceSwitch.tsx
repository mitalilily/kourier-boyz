import { ShopOutlined, TruckOutlined } from '@ant-design/icons'
import { useEffect } from 'react'
import {
  openAdminWorkspace,
  rememberAdminWorkspacePath,
  type AdminWorkspace,
} from '../config/adminWorkspace'

interface AdminWorkspaceSwitchProps {
  active: AdminWorkspace
}

const AdminWorkspaceSwitch = ({ active }: AdminWorkspaceSwitchProps) => {
  useEffect(() => {
    rememberAdminWorkspacePath(active, `${window.location.pathname}${window.location.search}`)
  }, [active])

  const selectWorkspace = (workspace: AdminWorkspace) => {
    if (workspace === active) return
    openAdminWorkspace(workspace)
  }

  return (
    <div className="kb-admin-workspace-switch" role="tablist" aria-label="Admin dashboard">
      <button
        type="button"
        role="tab"
        aria-selected={active === 'marketplace'}
        className={active === 'marketplace' ? 'is-active' : ''}
        onClick={() => selectWorkspace('marketplace')}
        title="Manage marketplace sellers, catalog, orders and settlements"
      >
        <ShopOutlined />
        <span>Marketplace</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'logistics'}
        className={active === 'logistics' ? 'is-active' : ''}
        onClick={() => selectWorkspace('logistics')}
        title="Manage courier clients, shipments, rates and reconciliation"
      >
        <TruckOutlined />
        <span>Courier Ops</span>
      </button>
    </div>
  )
}

export default AdminWorkspaceSwitch
