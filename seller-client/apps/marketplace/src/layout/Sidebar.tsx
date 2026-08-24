import {
  AppstoreOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SyncOutlined,
  TagOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Badge, Menu } from 'antd'
import { FolderIcon, LucideIndianRupee } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../api/profileQueries'
import { useAuthStore } from '../store/authStore'

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const Sidebar = ({ collapsed, setCollapsed }: SidebarProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const { data: profileData } = useProfile()

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const menuItems = [
    {
      key: 'overview',
      type: 'group' as const,
      label: !collapsed && 'Overview',
      children: [
        {
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: 'Dashboard',
          className: 'seller-tour-dashboard',
        },
      ],
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'catalog',
      type: 'group' as const,
      label: !collapsed && 'Catalog Management',
      children: [
        {
          key: '/products',
          icon: <AppstoreOutlined />,
          label: 'Products',
          className: 'seller-tour-products',
        },
        {
          key: '/categories',
          icon: <TagsOutlined />,
          label: 'Categories',
          disabled: false,
          className: 'seller-tour-categories',
        },
        {
          key: '/brands',
          icon: <ShopOutlined />,
          label: 'Brands',
          disabled: false,
          className: 'seller-tour-brands',
        },
      ],
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'orders',
      type: 'group' as const,
      label: !collapsed && 'Orders & Sales',
      children: [
        {
          key: '/orders',
          icon: <ShoppingCartOutlined />,
          label: 'Orders',
          disabled: false,
          className: 'seller-tour-orders',
        },
        {
          key: '/returns',
          icon: <SyncOutlined />,
          label: 'Returns',
          disabled: false,
          className: 'seller-tour-returns',
        },
        {
          key: '/settlements',
          icon: <LucideIndianRupee size={16} />,
          label: 'Settlements',
          disabled: false,
          className: 'seller-tour-settlements',
        },
        {
          key: '/invoices',
          icon: <FolderIcon size={16} />,
          label: 'Settlement Invoices',
          disabled: false,
          className: 'seller-tour-invoices',
        },
        {
          key: '/ledger',
          icon: <FileTextOutlined />,
          label: 'Ledger',
          disabled: false,
          className: 'seller-tour-ledger',
        },
        {
          key: '/reports',
          icon: <FileExcelOutlined />,
          label: 'Reports',
          disabled: false,
          className: 'seller-tour-reports',
        },
        {
          key: '/customers',
          icon: <UserOutlined />,
          label: 'Customers',
          disabled: false,
          className: 'seller-tour-customers',
        },
        {
          key: '/reviews',
          icon: <MessageOutlined />,
          label: 'Reviews & Ratings',
          disabled: false,
          className: 'seller-tour-reviews',
        },
        {
          key: '/coupons',
          icon: <TagOutlined />,
          label: 'Coupons',
          disabled: false,
          className: 'seller-tour-coupons',
        },
        // {
        //   key: '/earnings',
        //   icon: <DollarOutlined />,
        //   label: 'Earnings',
        //   disabled: true,
        // },
      ],
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'other',
      type: 'group' as const,
      label: !collapsed && 'Other',
      children: [
        {
          key: '/tickets',
          icon: <QuestionCircleOutlined />,
          label: 'Support Tickets',
          disabled: false,
          className: 'seller-tour-tickets',
        },
        {
          key: '/notifications',
          icon: <BellOutlined />,
          label: 'Notifications',
          className: 'seller-tour-notifications',
        },
        {
          key: '/certificates',
          icon: <SafetyCertificateOutlined />,
          label: 'Certificates',
          className: 'seller-tour-certificates',
        },
      ],
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'settings',
      type: 'group' as const,
      label: !collapsed && 'Settings',
      children: [
        {
          key: '/profile',
          icon: <UserOutlined />,
          label: 'Profile',
          className: 'seller-tour-profile',
        },
        {
          key: '/store-settings',
          icon: <SettingOutlined />,
          label: 'Store Settings',
          disabled: false,
          className: 'seller-tour-store-settings',
        },
      ],
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout()
      navigate('/login')
    } else {
      navigate(key)
      // Close sidebar on mobile after navigation
      if (windowWidth < 992) {
        setCollapsed(true)
      }
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Logo */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '16px' : '16px 20px',
          borderBottom: '1px solid #e8e8e8',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        {collapsed ? (
          <img
            src="/store/brand/kourier-boyz-mark.png"
            alt="Kourier Boyz"
            style={{
              height: 32,
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/store/brand/kourier-boyz-logo-transparent.png"
              alt="Kourier Boyz"
              style={{
                height: 28,
                width: 'auto',
                objectFit: 'contain',
              }}
            />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#B78115', lineHeight: '20px' }}>
                Seller
              </div>
              <div
                style={{ fontSize: 10, color: '#DFB743', fontWeight: 600, letterSpacing: '0.5px' }}
              >
                HUB
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Info (when not collapsed) */}
      {!collapsed && (
        <div
          onClick={() => navigate('/profile')}
          style={{
            padding: '16px',
            margin: '12px 16px',
            background: 'linear-gradient(135deg, #F7F2E5 0%, #fffce6 100%)',
            border: '1px solid #D9DCDA',
            borderRadius: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(183, 129, 21, 0.16)'
            e.currentTarget.style.borderColor = '#B78115'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.borderColor = '#D9DCDA'
          }}
        >
          {/* Decorative accent */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 60,
              height: 60,
              background: 'linear-gradient(135deg, #DFB743 0%, #555D61 100%)',
              opacity: 0.1,
              borderRadius: '0 0 0 60px',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Badge dot color={user?.isApproved ? '#52c41a' : '#DFB743'} offset={[-4, 4]}>
              <Avatar
                size={48}
                src={
                  profileData?.profilePhoto ||
                  profileData?.storeLogo ||
                  user?.profilePhoto ||
                  user?.storeLogo
                }
                icon={
                  !profileData?.profilePhoto &&
                  !profileData?.storeLogo &&
                  !user?.profilePhoto &&
                  !user?.storeLogo && <UserOutlined />
                }
                style={{
                  background: user?.isApproved ? '#B78115' : '#DFB743',
                  border: '2px solid #fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              />
            </Badge>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: '#B78115',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'Seller'}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'black',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: 6,
                }}
              >
                {user?.businessName || 'Your Store'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {user?.isApproved ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      color: '#52c41a',
                      fontWeight: 600,
                      background: '#f6ffed',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid #b7eb8f',
                    }}
                  >
                    <CheckCircleOutlined style={{ fontSize: 10 }} />
                    Verified
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      color: '#DFB743',
                      fontWeight: 600,
                      background: '#fffce6',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid #ffeeb3',
                    }}
                  >
                    Pending
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={handleMenuClick}
          items={menuItems}
          style={{
            border: 'none',
            background: 'transparent',
          }}
          theme="light"
        />
      </div>

      {/* Logout */}
      <div style={{ borderTop: '1px solid #e8e8e8', padding: '8px 0' }}>
        <Menu
          mode="inline"
          onClick={({ key }) => {
            if (key === 'logout') {
              // Close sidebar on mobile before logout
              if (windowWidth < 992) {
                setCollapsed(true)
              }
              logout()
              navigate('/login')
            }
          }}
          items={[
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: 'Logout',
              danger: true,
            },
          ]}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>
    </div>
  )
}

export default Sidebar
