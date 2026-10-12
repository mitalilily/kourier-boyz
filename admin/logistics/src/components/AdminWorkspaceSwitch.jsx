import { Button, Flex } from '@chakra-ui/react'
import { IconBuildingStore, IconTruckDelivery } from '@tabler/icons-react'
import { useEffect } from 'react'
import { openAdminWorkspace, rememberAdminWorkspacePath } from 'config/adminWorkspace'

const AdminWorkspaceSwitch = ({ active }) => {
  useEffect(() => {
    rememberAdminWorkspacePath(active, `${window.location.pathname}${window.location.search}`)
  }, [active])

  const selectWorkspace = (workspace) => {
    if (workspace === active) return
    openAdminWorkspace(workspace)
  }

  return (
    <Flex className="kb-logistics-workspace-switch" role="tablist" aria-label="Admin dashboard">
      <Button
        role="tab"
        aria-selected={active === 'marketplace'}
        className={active === 'marketplace' ? 'is-active' : ''}
        leftIcon={<IconBuildingStore size={16} />}
        onClick={() => selectWorkspace('marketplace')}
        title="Manage marketplace sellers, catalogue, orders and settlements"
      >
        Marketplace
      </Button>
      <Button
        role="tab"
        aria-selected={active === 'logistics'}
        className={active === 'logistics' ? 'is-active' : ''}
        leftIcon={<IconTruckDelivery size={16} />}
        onClick={() => selectWorkspace('logistics')}
        title="Manage courier clients, shipments, rates and reconciliation"
      >
        Courier Ops
      </Button>
    </Flex>
  )
}

export default AdminWorkspaceSwitch
