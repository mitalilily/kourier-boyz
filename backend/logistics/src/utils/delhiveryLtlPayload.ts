type DelhiveryLtlShipmentDetailBox = {
  box_name?: string
  quantity?: number | string | null
  weight?: number | string | null
}

type BuildDelhiveryLtlShipmentDetailsParams = {
  boxes?: DelhiveryLtlShipmentDetailBox[] | null
  normalizedOrderNumber: string
  description: string
  totalWeightGrams: number
}

export const buildDelhiveryLtlShipmentDetailsPayload = ({
  boxes,
  normalizedOrderNumber,
  description,
  totalWeightGrams,
}: BuildDelhiveryLtlShipmentDetailsParams) => {
  const panelOrderReference = String(normalizedOrderNumber || '').trim()
  const fallbackDescription = String(description || panelOrderReference).trim() || panelOrderReference

  if (Array.isArray(boxes) && boxes.length > 0) {
    return boxes.map((box) => ({
      // Delhivery surfaces this as the PO reference, so keep our panel order ID unchanged
      // across every package row instead of generating per-box suffixed values.
      order_id: panelOrderReference,
      box_count: Math.max(1, Number(box?.quantity ?? 1) || 1),
      description: String(box?.box_name || fallbackDescription).trim() || fallbackDescription,
      weight: Math.max(1, Math.round(Number(box?.weight ?? 0) * 1000)),
    }))
  }

  return [
    {
      order_id: panelOrderReference,
      box_count: 1,
      description: fallbackDescription,
      weight: Math.max(1, Math.round(Number(totalWeightGrams || 0)) || 1),
    },
  ]
}
