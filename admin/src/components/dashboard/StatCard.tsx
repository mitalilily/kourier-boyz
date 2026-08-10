import { Card, Tooltip, Spin } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: number | string
  icon?: ReactNode
  iconBgColor?: string
  iconColor?: string
  accentColor?: string
  suffix?: ReactNode
  change?: number
  previousValue?: number
  loading?: boolean
  tooltip?: string
  onClick?: () => void
  formatter?: (value: number | string) => string
}

const StatCard = ({
  title,
  value,
  icon,
  iconBgColor = '#f0f5ff',
  iconColor = '#1890ff',
  accentColor = '#1890ff',
  suffix,
  change,
  previousValue,
  loading,
  tooltip,
  onClick,
  formatter,
}: StatCardProps) => {
  const isPositive = change !== undefined && change >= 0
  const hasChange = change !== undefined

  const formattedValue = formatter ? formatter(value) : value

  if (loading) {
    return (
      <Card
        className="h-full border-0 shadow-sm"
        styles={{ body: { padding: '24px' } }}
      >
        <div className="flex items-center justify-center h-24">
          <Spin />
        </div>
      </Card>
    )
  }

  const card = (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      className={`h-full border-0 shadow-sm transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : ''
      }`}
      styles={{ body: { padding: '24px' } }}
    >
      <div className="flex items-start justify-between">
        {/* Left side - Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-500 text-sm font-medium">{title}</span>
            {tooltip && (
              <Tooltip title={tooltip}>
                <InfoCircleOutlined className="text-gray-300 text-xs cursor-help hover:text-gray-400" />
              </Tooltip>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-bold tracking-tight"
              style={{ color: '#1f2937' }}
            >
              {formattedValue}
            </span>
            {suffix && <span className="text-gray-500">{suffix}</span>}
          </div>

          {hasChange && (
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isPositive
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-500'
                }`}
              >
                {isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {Math.abs(change)}%
              </span>
              {previousValue !== undefined && (
                <span className="text-gray-400 text-xs">
                  vs {formatter ? formatter(previousValue) : previousValue}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side - Icon */}
        {icon && (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconBgColor }}
          >
            <span className="text-xl" style={{ color: iconColor }}>
              {icon}
            </span>
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg"
        style={{
          background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}40 100%)`,
        }}
      />
    </Card>
  )

  // Wrap with tooltip if clickable
  if (onClick) {
    return (
      <Tooltip title="Click to view">
        <span style={{ display: 'block', height: '100%' }}>{card}</span>
      </Tooltip>
    )
  }

  return card
}

export default StatCard

