import Return from '../models/Return'
import { shippingProviderService } from './shippingProvider.service'
import { appendReturnTimeline } from '../utils/returns'

const REVERSE_IN_TRANSIT_STATUSES = ['in_transit', 'picked', 'picked_up']
const REVERSE_COMPLETED_STATUSES = ['delivered', 'delivered_to_seller']

export const runReverseReturnTrackingSweep = async (): Promise<{ updatedCount: number }> => {
  const pendingReturns = await Return.find({
    courierReverseAwb: { $ne: null },
    status: { $in: ['REVERSE_PICKUP_CREATED', 'REVERSE_PICKUP_IN_TRANSIT'] },
  }).exec()

  let updatedCount = 0

  for (const ret of pendingReturns) {
    const awb = ret.courierReverseAwb
    if (!awb) continue

    try {
      const tracking = await shippingProviderService.trackReturnShipment({ awb })
      const courierStatus = tracking.data?.status?.toLowerCase() || ''

      if (
        REVERSE_IN_TRANSIT_STATUSES.includes(courierStatus) &&
        ret.status === 'REVERSE_PICKUP_CREATED'
      ) {
        ret.status = 'REVERSE_PICKUP_IN_TRANSIT'
        appendReturnTimeline(ret, 'REVERSE_PICKUP_IN_TRANSIT', 'Reverse shipment in transit')
        await ret.save()
        updatedCount += 1
      } else if (REVERSE_COMPLETED_STATUSES.includes(courierStatus)) {
        if (ret.status !== 'REVERSE_PICKUP_COMPLETED') {
          ret.status = 'REVERSE_PICKUP_COMPLETED'
          appendReturnTimeline(
            ret,
            'REVERSE_PICKUP_COMPLETED',
            'Reverse shipment delivered to seller hub',
          )
          await ret.save()
          updatedCount += 1
        }
      }
    } catch (err) {
      // Tracking failures should not stop the sweep
      // eslint-disable-next-line no-console
      console.error('Error tracking reverse return shipment', ret._id, err)
    }
  }

  return { updatedCount }
}
