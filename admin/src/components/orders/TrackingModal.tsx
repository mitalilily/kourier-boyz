import { ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import type { AdminSellerShipment } from '../../api/orders'
import { trackShipmentApi } from '../../api/orders'

const { Text } = Typography

interface TrackingModalProps {
  open: boolean
  onClose: () => void
  orderId: string
  shipment: AdminSellerShipment
}

interface TrackingEvent {
  status: string
  location?: string
  message?: string
  timestamp: string
}

interface TrackingData {
  awb_number: string
  order_number: string
  status: string
  current_location?: string
  estimated_delivery?: string
  tracking_events?: TrackingEvent[]
}

const TrackingModal = ({ open, onClose, orderId, shipment }: TrackingModalProps) => {
  const [loading, setLoading] = useState(false)
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Compute AWB from shipment prop (always get fresh value)
  const getAwb = () => shipment.shippingMeta?.awb || shipment.kourierBoyzLogistics?.awb_number
  const awb = getAwb()
  const courier = shipment.shippingMeta?.courier || 'Unknown'
  const platformStatus = shipment.status
  const platformTrackingEvents = shipment.trackingEvents || []

  const fetchTracking = async () => {
    // The backend endpoint uses shipment._id and will validate AWB
    // We don't need to check AWB here as backend will return appropriate error
    setLoading(true)
    setError(null)
    try {
      const response = await trackShipmentApi(orderId, shipment._id)
      if (response.success && response.data) {
        // Type assertion since we know the structure from backend
        const data = response.data as unknown as TrackingData
        setTrackingData(data)
      } else {
        setError('Failed to fetch tracking information')
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || err?.message || 'Failed to fetch tracking information'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && shipment._id) {
      void fetchTracking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shipment._id])

  // Combine provider events with Kourier Boyz status
  const allEvents = useMemo(() => {
    const events: Array<{
      source: 'courier' | 'platform'
      status: string
      location?: string
      message?: string
      timestamp: Date
    }> = []

    // Add provider tracking events
    if (trackingData?.tracking_events) {
      trackingData.tracking_events.forEach((event: any) => {
        events.push({
          source: 'courier',
          status: event.status_code || event.status || 'unknown',
          location: event.location || '',
          message: event.message || '',
          timestamp: new Date(event.event_time || event.timestamp || Date.now()),
        })
      })
    }

    // Add Kourier Boyz status events
    platformTrackingEvents.forEach((event) => {
      events.push({
        source: 'platform',
        status: event.status,
        location: event.location,
        message: event.message,
        timestamp: new Date(event.timestamp),
      })
    })

    // Sort by timestamp (newest first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [trackingData, platformTrackingEvents])

  const statusColors: Record<string, string> = {
    pending: 'default',
    processing: 'blue',
    pickup_requested: 'cyan',
    shipped: 'blue',
    in_transit: 'purple',
    out_for_delivery: 'orange',
    delivered: 'green',
    cancelled: 'red',
  }

  return (
    <Modal
      title="Track Shipment"
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchTracking} loading={loading}>
          Refresh
        </Button>,
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <Space direction="vertical" size="large" className="w-full">
        {/* Shipment Info */}
        <Card size="small">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="AWB Number">
              <Text code>{awb || 'N/A'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Courier">
              <Tag>{courier}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Kourier Boyz Status">
              <Tag color={statusColors[platformStatus] || 'default'}>
                {platformStatus.replace(/_/g, ' ')}
              </Tag>
            </Descriptions.Item>
            {trackingData?.status && (
              <Descriptions.Item label="Courier Status">
                <Tag>{trackingData.status}</Tag>
              </Descriptions.Item>
            )}
            {trackingData?.current_location && (
              <Descriptions.Item label="Current Location">
                {trackingData.current_location}
              </Descriptions.Item>
            )}
            {trackingData?.estimated_delivery && (
              <Descriptions.Item label="Estimated Delivery">
                {dayjs(trackingData.estimated_delivery).format('DD MMM YYYY')}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Tracking Timeline */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Spin size="large" />
          </div>
        ) : error ? (
          <Alert message="Error" description={error} type="error" showIcon />
        ) : allEvents.length === 0 ? (
          <Empty description="No tracking events available" />
        ) : (
          <Card title="Tracking Timeline" size="small">
            <Timeline
              mode="left"
              items={allEvents.map((event) => ({
                color: event.source === 'courier' ? 'blue' : 'green',
                label: dayjs(event.timestamp).format('DD MMM YYYY, HH:mm'),
                children: (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Text strong>{event.status}</Text>
                      <Tag color={event.source === 'courier' ? 'blue' : 'green'}>
                        {event.source === 'courier' ? 'Shipmozo' : 'Kourier Boyz'}
                      </Tag>
                    </div>
                    {event.location && event.location.trim() && (
                      <div className="text-sm text-gray-600 mb-1">📍 {event.location}</div>
                    )}
                    {event.message && event.message.trim() && (
                      <div className="text-sm text-gray-500">{event.message}</div>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>
        )}

        {/* Info Alert */}
        <Alert
          message="Tracking Information"
          description="This combines tracking data from Shipmozo and Kourier Boyz order status updates. Events are sorted by timestamp."
          type="info"
          showIcon
        />
      </Space>
    </Modal>
  )
}

export default TrackingModal
