import { Button, Flex } from '@chakra-ui/react'
import { IconBuildingStore, IconTruckDelivery } from '@tabler/icons-react'

const ADMIN_WORKSPACE_KEY = 'kb_admin_workspace'

const AdminWorkspaceSwitch = ({ active }) => {
  const selectWorkspace = (workspace) => {
    localStorage.setItem(ADMIN_WORKSPACE_KEY, workspace)

    if (workspace === active) return

    window.location.assign(workspace === 'marketplace' ? '/' : '/logistics/')
  }

  return (
    <Flex className="kb-logistics-workspace-switch" role="tablist" aria-label="Admin dashboard">
      <Button
        role="tab"
        aria-selected={active === 'marketplace'}
        className={active === 'marketplace' ? 'is-active' : ''}
        leftIcon={<IconBuildingStore size={16} />}
        onClick={() => selectWorkspace('marketplace')}
      >
        Marketplace
      </Button>
      <Button
        role="tab"
        aria-selected={active === 'logistics'}
        className={active === 'logistics' ? 'is-active' : ''}
        leftIcon={<IconTruckDelivery size={16} />}
        onClick={() => selectWorkspace('logistics')}
      >
        Logistics
      </Button>
    </Flex>
  )
}

export default AdminWorkspaceSwitch
