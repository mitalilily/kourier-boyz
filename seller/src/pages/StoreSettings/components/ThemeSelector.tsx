import { CheckOutlined } from '@ant-design/icons'
import { Card, Row, Col, Typography, Badge, Tooltip } from 'antd'
import { themes } from '../../../utils/themes'
import type { ThemeConfig } from '../../../utils/themes'

const { Text } = Typography

interface ThemeSelectorProps {
  value?: string
  onChange?: (themeId: string) => void
}

const ThemeSelector = ({ value, onChange }: ThemeSelectorProps) => {
  return (
    <div style={{ padding: '8px 0' }}>
      <Row gutter={[20, 20]}>
        {themes.map((theme: ThemeConfig) => {
          const isSelected = value === theme.id || (!value && theme.id === 'modern')
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={theme.id}>
              <Tooltip title={isSelected ? 'Currently selected' : 'Click to select'}>
                <Card
                  hoverable
                  onClick={() => onChange?.(theme.id)}
                  style={{
                    border: isSelected
                      ? `3px solid ${theme.colors.primary}`
                      : '2px solid #e8e8e8',
                    borderRadius: 12,
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    background: theme.colors.surface,
                    boxShadow: isSelected
                      ? `0 8px 24px ${theme.colors.primary}25`
                      : '0 2px 8px rgba(0,0,0,0.08)',
                    transform: isSelected ? 'translateY(-4px)' : 'translateY(0)',
                  }}
                  bodyStyle={{ padding: 0 }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
                    }
                  }}
                >
                  {/* Selected Badge */}
                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 10,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: theme.colors.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        boxShadow: `0 4px 12px ${theme.colors.primary}40`,
                        animation: 'pulse 2s infinite',
                      }}
                    >
                      <CheckOutlined style={{ fontSize: 16, fontWeight: 'bold' }} />
                    </div>
                  )}

                  {/* Theme Preview Header */}
                  <div
                    style={{
                      width: '100%',
                      height: 120,
                      background:
                        theme.styles.headerStyle === 'gradient'
                          ? `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`
                          : theme.styles.headerStyle === 'solid'
                            ? theme.colors.primary
                            : `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      padding: '20px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Decorative Circles */}
                    <div
                      style={{
                        position: 'absolute',
                        top: -20,
                        right: -20,
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -30,
                        left: -30,
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.08)',
                      }}
                    />

                    {/* Mini Store Preview */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        zIndex: 1,
                      }}
                    >
                      {/* Store Name Bar */}
                      <div
                        style={{
                          width: '100%',
                          height: 24,
                          background: 'rgba(255,255,255,0.2)',
                          borderRadius: theme.styles.borderRadius || '4px',
                          backdropFilter: 'blur(10px)',
                        }}
                      />
                      {/* Color Swatches */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            backgroundColor: theme.colors.primary,
                            border: '3px solid rgba(255,255,255,0.5)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            transition: 'transform 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                        />
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            backgroundColor: theme.colors.secondary,
                            border: '3px solid rgba(255,255,255,0.5)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            transition: 'transform 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                        />
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            backgroundColor: theme.colors.accent,
                            border: '3px solid rgba(255,255,255,0.5)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            transition: 'transform 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                        />
                      </div>
                      {/* Button Preview */}
                      <div
                        style={{
                          width: '80%',
                          height: 20,
                          background: 'rgba(255,255,255,0.3)',
                          borderRadius: theme.styles.borderRadius || '4px',
                          margin: '0 auto',
                          backdropFilter: 'blur(10px)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Color Palette Strip */}
                  <div
                    style={{
                      display: 'flex',
                      height: 6,
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        background: theme.colors.primary,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: theme.colors.secondary,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: theme.colors.accent,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: theme.colors.background,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: theme.colors.surface,
                        borderLeft: `1px solid ${theme.colors.border}`,
                      }}
                    />
                  </div>

                  {/* Theme Info */}
                  <div style={{ padding: '20px 16px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        strong
                        style={{
                          fontSize: 16,
                          color: theme.colors.text,
                          margin: 0,
                        }}
                      >
                        {theme.name}
                      </Text>
                      {isSelected && (
                        <Badge
                          status="success"
                          text="Active"
                          style={{
                            fontSize: 11,
                          }}
                        />
                      )}
                    </div>
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: theme.colors.textSecondary,
                        display: 'block',
                      }}
                    >
                      {theme.description}
                    </Text>

                    {/* Style Tags */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        marginTop: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          padding: '4px 8px',
                          background: `${theme.colors.primary}15`,
                          color: theme.colors.primary,
                          borderRadius: 4,
                          fontWeight: 500,
                          textTransform: 'capitalize',
                        }}
                      >
                        {theme.styles.headerStyle}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '4px 8px',
                          background: `${theme.colors.secondary}15`,
                          color: theme.colors.secondary,
                          borderRadius: 4,
                          fontWeight: 500,
                          textTransform: 'capitalize',
                        }}
                      >
                        {theme.styles.cardStyle}
                      </span>
                    </div>
                  </div>
                </Card>
              </Tooltip>
            </Col>
          )
        })}
      </Row>

      {/* Add CSS for pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.9;
            }
          }
        `}
      </style>
    </div>
  )
}

export default ThemeSelector

