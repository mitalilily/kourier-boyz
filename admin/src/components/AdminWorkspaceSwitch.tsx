import { ShopOutlined, TruckOutlined } from '@ant-design/icons'

type AdminWorkspace = 'marketplace' | 'logistics'

interface AdminWorkspaceSwitchProps {
  active: AdminWorkspace
}

const ADMIN_WORKSPACE_KEY = 'kb_admin_workspace'

const AdminWorkspaceSwitch = ({ active }: AdminWorkspaceSwitchProps) => {
  const selectWorkspace = (workspace: AdminWorkspace) => {
    localStorage.setItem(ADMIN_WORKSPACE_KEY, workspace)

    if (workspace === active) return

    window.location.assign(workspace === 'marketplace' ? '/' : '/logistics/')
  }

  return (
    <div className="kb-admin-workspace-switch" role="tablist" aria-label="Admin dashboard">
      <button
        type="button"
        role="tab"
        aria-selected={active === 'marketplace'}
        className={active === 'marketplace' ? 'is-active' : ''}
        onClick={() => selectWorkspace('marketplace')}
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
      >
        <TruckOutlined />
        <span>Logistics</span>
      </button>
    </div>
  )
}

export default AdminWorkspaceSwitch
