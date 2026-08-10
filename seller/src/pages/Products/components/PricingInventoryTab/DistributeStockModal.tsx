import { Button, Modal } from 'antd'
import type { VariantType, PickupAddressWithId } from './types'
import WarehouseInventoryContent from './WarehouseInventoryContent'

interface DistributeStockModalProps {
  open: boolean
  variant: VariantType | null
  variants: Array<VariantType>
  pickupAddresses: PickupAddressWithId[]
  onVariantsChange: (variants: Array<VariantType>) => void
  onClose: () => void
}

export default function DistributeStockModal({
  open,
  variant,
  variants,
  pickupAddresses,
  onVariantsChange,
  onClose,
}: DistributeStockModalProps) {
  if (!variant) return null

  return (
    <Modal
      title={`Distribute Stock - ${variant.name || ''}`}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={900}
      style={{ top: 20 }}
    >
      <WarehouseInventoryContent
        variant={variant}
        variants={variants}
        pickupAddresses={pickupAddresses}
        onVariantsChange={onVariantsChange}
      />
    </Modal>
  )
}

