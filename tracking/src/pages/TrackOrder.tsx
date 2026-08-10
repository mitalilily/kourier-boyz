import axios from 'axios'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import './TrackOrder.css'

dayjs.extend(relativeTime)

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5004/api'
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5174'

interface FooterSettings {
  description?: string
  phone?: string
  email?: string
  address?: string
  socialLinks?: Array<{
    platform: string
    url: string
    order?: number
  }>
}

interface TrackingEvent {
  status: string
  location?: string
  message?: string
  timestamp: string | Date
}

interface TrackingData {
  order: {
    _id: string
    orderNumber: string
    status: string
    createdAt: string
    shippingAddress?: {
      name: string
      phone: string
      addressLine1: string
      addressLine2?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
  }
  shipment: {
    _id: string
    status: string
    awb: string
    courier?: string
    trackingEvents: TrackingEvent[]
  }
  courierCart: {
    awb_number: string
    order_number: string
    status: string
    current_location?: string
    estimated_delivery?: string
    tracking_events?: TrackingEvent[]
  } | null
}

const statusConfig: Record<string, { label: string; color: string; progress: number }> = {
  pending: { label: 'Order Pending', color: '#6b7280', progress: 10 },
  processing: { label: 'Processing', color: '#1353A4', progress: 25 },
  pickup_requested: { label: 'Pickup Requested', color: '#1353A4', progress: 40 },
  shipped: { label: 'Shipped', color: '#1353A4', progress: 55 },
  in_transit: { label: 'In Transit', color: '#1353A4', progress: 70 },
  out_for_delivery: { label: 'Out for Delivery', color: '#FFE14B', progress: 85 },
  delivered: { label: 'Delivered', color: '#10b981', progress: 100 },
  cancelled: { label: 'Cancelled', color: '#ef4444', progress: 0 },
}

const TrackOrder = () => {
  const { identifier } = useParams<{ identifier: string }>()
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(identifier || '')
  const [footerSettings, setFooterSettings] = useState<FooterSettings | null>(null)

  const fetchTracking = async (trackingId: string) => {
    if (!trackingId.trim()) {
      setError('Please enter an AWB number or Order Number')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`${API_BASE_URL}/tracking/${trackingId}`)
      if (response.data.success) {
        setTrackingData(response.data.data)
      } else {
        setError(response.data.message || 'Failed to fetch tracking information')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch tracking information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (identifier) {
      void fetchTracking(identifier)
    }
  }, [identifier])

  // Fetch footer settings from admin
  useEffect(() => {
    const fetchFooterSettings = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/admin/settings/public/footer`)
        if (response.data.success) {
          setFooterSettings(response.data.data)
        }
      } catch (err) {
        console.error('Failed to fetch footer settings:', err)
        // Use fallback values if API fails
        setFooterSettings({
          email: 'support@kourierboyz.com',
          phone: '+1234567890',
        })
      }
    }
    void fetchFooterSettings()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      window.history.pushState({}, '', `/${searchInput.trim()}`)
      void fetchTracking(searchInput.trim())
    }
  }

  // Combine provider events with Kourier Boyz events
  const allEvents: Array<{
    source: 'courier' | 'platform'
    status: string
    location?: string
    message?: string
    timestamp: Date
  }> = []

  if (trackingData) {
    // Add provider events first
    if (
      trackingData.courierCart?.tracking_events &&
      Array.isArray(trackingData.courierCart.tracking_events)
    ) {
      console.log(
        '[TrackOrder] Provider events found:',
        trackingData.courierCart.tracking_events.length,
      )
      trackingData.courierCart.tracking_events.forEach((event: any) => {
        const processedEvent = {
          source: 'courier' as const,
          status: event.status_code || event.status || 'unknown',
          location: event.location || '',
          message: event.message || '',
          timestamp: new Date(event.event_time || event.timestamp || Date.now()),
        }
        console.log('[TrackOrder] Processing provider event:', processedEvent)
        allEvents.push(processedEvent)
      })
    } else {
      console.log('[TrackOrder] No provider tracking_events found', {
        hasCourierCart: !!trackingData.courierCart,
        trackingEvents: trackingData.courierCart?.tracking_events,
      })
    }

    // Add Kourier Boyz events
    if (
      trackingData.shipment.trackingEvents &&
      Array.isArray(trackingData.shipment.trackingEvents)
    ) {
      console.log('[TrackOrder] Kourier Boyz events found:', trackingData.shipment.trackingEvents.length)
      trackingData.shipment.trackingEvents.forEach((event: any) => {
        const processedEvent = {
          source: 'platform' as const,
          status: event.status || 'unknown',
          location: event.location || '',
          message: event.message || '',
          timestamp: new Date(event.timestamp),
        }
        console.log('[TrackOrder] Processing Kourier Boyz event:', processedEvent)
        allEvents.push(processedEvent)
      })
    }

    // Sort by timestamp (oldest first for chronological timeline)
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    console.log('[TrackOrder] Total events after merge:', allEvents.length, allEvents)
  }

  const currentStatus = trackingData?.order.status || trackingData?.shipment.status || 'pending'
  const statusInfo = statusConfig[currentStatus.toLowerCase()] || statusConfig.pending

  return (
    <div className="track-order-container">
      {/* Professional Header */}
      <header className="track-order-header">
        <div className="header-content">
          <div className="header-brand">
            <img src="/logo.png" alt="Kourier Boyz" className="header-logo" />
            <div className="header-text">
              <h1 className="header-title">Kourier Boyz</h1>
              <p className="header-subtitle">Order Tracking</p>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Search Section */}
        {!trackingData && (
          <div className="search-container">
            <div className="search-card">
              <h2 className="search-title">Track Your Order</h2>
              <p className="search-description">
                Enter your AWB number or Order Number to track your shipment
              </p>
              <form onSubmit={handleSearch} className="search-form">
                <div className="input-group">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="AWB Number or Order Number"
                    className="search-input"
                    disabled={loading}
                  />
                  <button type="submit" className="search-button" disabled={loading}>
                    {loading ? 'Tracking...' : 'Track'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-container">
            <div className="error-card">
              <div className="error-title">Unable to Track Order</div>
              <div className="error-message">{error}</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Fetching tracking information...</p>
          </div>
        )}

        {/* Tracking Results */}
        {trackingData && !loading && (
          <div className="tracking-container">
            {/* Order Status Section */}
            <div className="status-section">
              <div className="status-card">
                <div className="status-badge" style={{ backgroundColor: statusInfo.color }}>
                  {statusInfo.label}
                </div>
                <div className="progress-wrapper">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${statusInfo.progress}%`,
                        backgroundColor: statusInfo.color,
                      }}
                    ></div>
                  </div>
                  <div className="progress-text">{statusInfo.progress}% Complete</div>
                </div>
              </div>
            </div>

            {/* Order Information Grid */}
            <div className="info-grid">
              <div className="info-card">
                <div className="info-label">Order Number</div>
                <div className="info-value">{trackingData.order.orderNumber}</div>
              </div>
              <div className="info-card">
                <div className="info-label">AWB Number</div>
                <div className="info-value code">{trackingData.shipment.awb}</div>
              </div>
              {trackingData.shipment.courier && (
                <div className="info-card">
                  <div className="info-label">Courier Partner</div>
                  <div className="info-value">{trackingData.shipment.courier}</div>
                </div>
              )}
              {trackingData.courierCart?.estimated_delivery && (
                <div className="info-card">
                  <div className="info-label">Estimated Delivery</div>
                  <div className="info-value">
                    {dayjs(trackingData.courierCart.estimated_delivery).format('DD MMM YYYY')}
                  </div>
                </div>
              )}
            </div>

            {/* Tracking Timeline */}
            {allEvents.length > 0 ? (
              <div className="timeline-section">
                <div className="section-header">
                  <h2 className="section-title">Tracking History</h2>
                  <p className="section-subtitle">Real-time updates from courier and Kourier Boyz</p>
                </div>
                <div className="timeline">
                  {allEvents.map((event, index) => {
                    const isLatest = index === allEvents.length - 1
                    return (
                      <div key={index} className={`timeline-item ${isLatest ? 'latest' : ''}`}>
                        <div className="timeline-marker">
                          <div
                            className="timeline-dot"
                            style={{
                              backgroundColor: event.source === 'courier' ? '#1353A4' : '#FFE14B',
                              borderColor: event.source === 'courier' ? '#1353A4' : '#FFE14B',
                            }}
                          ></div>
                          {index < allEvents.length - 1 && <div className="timeline-line"></div>}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <div className="timeline-status">
                              {event.message && event.message.trim() ? event.message : event.status}
                            </div>
                            <div
                              className="timeline-source"
                              style={{
                                backgroundColor: event.source === 'courier' ? '#1353A4' : '#FFE14B',
                                color: event.source === 'courier' ? 'white' : '#000000',
                              }}
                            >
                              {event.source === 'courier' ? 'Shipmozo' : 'Kourier Boyz'}
                            </div>
                          </div>
                          {event.message &&
                            event.message.trim() &&
                            event.status !== event.message && (
                              <div
                                className="timeline-status-code"
                                style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}
                              >
                                Status: {event.status}
                              </div>
                            )}
                          <div className="timeline-time">
                            {dayjs(event.timestamp).format('DD MMM YYYY, hh:mm A')} •{' '}
                            {dayjs(event.timestamp).fromNow()}
                          </div>
                          {event.location && event.location.trim() && (
                            <div className="timeline-location">{event.location}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3 className="empty-title">No Tracking Events Available</h3>
                <p className="empty-description">
                  Tracking information will appear here once your shipment is processed.
                </p>
              </div>
            )}

            {/* Delivery Address */}
            {trackingData.order.shippingAddress && (
              <div className="address-section">
                <div className="section-header">
                  <h2 className="section-title">Delivery Address</h2>
                </div>
                <div className="address-card">
                  <div className="address-name">{trackingData.order.shippingAddress.name}</div>
                  <div className="address-phone">{trackingData.order.shippingAddress.phone}</div>
                  <div className="address-details">
                    <div>{trackingData.order.shippingAddress.addressLine1}</div>
                    {trackingData.order.shippingAddress.addressLine2 && (
                      <div>{trackingData.order.shippingAddress.addressLine2}</div>
                    )}
                    <div>
                      {trackingData.order.shippingAddress.city},{' '}
                      {trackingData.order.shippingAddress.state}{' '}
                      {trackingData.order.shippingAddress.postalCode}
                    </div>
                    <div>{trackingData.order.shippingAddress.country}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Current Location */}
            {trackingData.courierCart?.current_location && (
              <div className="location-section">
                <div className="section-header">
                  <h2 className="section-title">Current Location</h2>
                  <p className="section-subtitle">Last known location of your package</p>
                </div>
                <div className="location-card">
                  <div className="location-value">{trackingData.courierCart.current_location}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Professional Footer */}
      <footer className="track-order-footer">
        <div className="footer-content">
          <div className="footer-links">
            <div className="footer-column">
              <h4>Support</h4>
              {footerSettings?.email && (
                <a href={`mailto:${footerSettings.email}`}>{footerSettings.email}</a>
              )}
              {footerSettings?.phone && (
                <a href={`tel:${footerSettings.phone.replace(/\s+/g, '')}`}>
                  {footerSettings.phone}
                </a>
              )}
              {!footerSettings && (
                <>
                  <a href="mailto:support@kourierboyz.com">support@kourierboyz.com</a>
                  <a href="tel:+1234567890">+1 (234) 567-890</a>
                </>
              )}
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <a href={`${FRONTEND_URL}/about-us`} target="_blank" rel="noopener noreferrer">
                About Us
              </a>
              <a href={`${FRONTEND_URL}/contact`} target="_blank" rel="noopener noreferrer">
                Contact
              </a>
            </div>
            <div className="footer-column">
              <h4>Legal</h4>
              <a href={`${FRONTEND_URL}/privacy-policy`} target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              <a href={`${FRONTEND_URL}/terms`} target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Kourier Boyz. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default TrackOrder
