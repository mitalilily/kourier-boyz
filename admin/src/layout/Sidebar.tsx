import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CalculatorOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  EditOutlined,
  FileTextOutlined,
  LikeOutlined,
  LogoutOutlined,
  MailOutlined,
  MessageOutlined,
  PictureOutlined,
  PoweroffOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  StarOutlined,
  TagOutlined,
  TagsOutlined,
  TrademarkOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Layout, Menu } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { isRouteAccessible } from '../utils/permissions'

const { Sider } = Layout

type MenuItem = Required<MenuProps>['items'][number]

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const permissions = useAuthStore((state) => state.permissions)
  const logout = useAuthStore((state) => state.logout)
  const role = useAuthStore((state) => state.role)

  const roleLabel = useMemo(() => {
    if (!role) return 'Admin'

    return role
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }, [role])

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [
      // 1. Overview
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      },
      { type: 'divider' },

      // 2. Order Lifecycle
      {
        key: '/orders',
        icon: <ShoppingCartOutlined />,
        label: 'Orders',
      },
      {
        key: '/returns',
        icon: <ReloadOutlined />,
        label: 'Returns',
      },
      { type: 'divider' },

      // 3. User Management
      {
        key: 'users-group',
        icon: <UserOutlined />,
        label: 'User Management',
        children: [
          {
            key: '/sellers',
            icon: <ShopOutlined />,
            label: 'Sellers',
          },
          {
            key: '/sellers/deactivation-requests',
            icon: <PoweroffOutlined />,
            label: 'Seller Deactivation Requests',
          },
          {
            key: '/customers',
            icon: <UserOutlined />,
            label: 'Customers',
          },
        ],
      },
      { type: 'divider' },

      // 4. Finance (MOST IMPORTANT)
      {
        key: 'finance-group',
        icon: <DollarOutlined />,
        label: 'Finance',
        children: [
          {
            key: '/settlements',
            icon: <DollarOutlined />,
            label: 'Settlement Batches',
          },
          {
            key: '/settlements/invoices',
            icon: <FileTextOutlined />,
            label: 'Seller Settlement Invoices',
          },
          {
            key: '/settlements/credit-notes',
            icon: <FileTextOutlined />,
            label: 'Seller Credit Notes',
          },
          // add when ready
          // {
          //   key: '/settlements/debit-notes',
          //   icon: <FileTextOutlined />,
          //   label: 'Seller Debit Notes',
          // },
          {
            key: '/settlements/audit-logs',
            icon: <SafetyOutlined />,
            label: 'Finance Audit Logs',
          },
        ],
      },
      { type: 'divider' },

      // 5. Reports & Compliance
      {
        key: 'reports-group',
        icon: <BarChartOutlined />,
        label: 'Reports & Compliance',
        children: [
          {
            key: '/reports/sales',
            icon: <BarChartOutlined />,
            label: 'Sales Report',
          },
          {
            key: '/reports/settlement-due',
            icon: <DollarOutlined />,
            label: 'Settlement Due Report',
          },
          {
            key: '/reports/portal-income',
            icon: <DollarOutlined />,
            label: 'Portal Income Report',
          },
          {
            key: '/reports/courier-charges',
            icon: <TruckOutlined />,
            label: 'Courier Charges Report',
          },
          {
            key: '/reports/tds',
            icon: <FileTextOutlined />,
            label: 'TDS Report (194-O)',
          },
          {
            key: '/reports/tcs',
            icon: <FileTextOutlined />,
            label: 'TCS Report (GST)',
          },
          {
            key: '/reports/sales-pending-status',
            icon: <ClockCircleOutlined />,
            label: 'Sales Pending Status',
          },
          {
            key: '/reports/new-sellers',
            icon: <UserOutlined />,
            label: 'New Seller Registrations',
          },
          {
            key: '/reports/tickets',
            icon: <MessageOutlined />,
            label: 'Support Ticket Report',
          },
        ],
      },
      { type: 'divider' },

      // 6. Catalog & Marketing
      {
        key: 'catalog-group',
        icon: <ShopOutlined />,
        label: 'Catalog & Marketing',
        children: [
          {
            key: '/products',
            icon: <AppstoreOutlined />,
            label: 'Products',
          },
          {
            key: '/categories',
            icon: <TagsOutlined />,
            label: 'Categories',
          },
          {
            key: '/brand-approvals',
            icon: <TrademarkOutlined />,
            label: 'Brand Approvals',
          },
          {
            key: '/category-extensions',
            icon: <ReloadOutlined />,
            label: 'Category Extensions',
          },
          {
            key: '/coupons',
            icon: <TagOutlined />,
            label: 'Coupons',
          },
          // {
          //   key: '/seller-coupons',
          //   icon: <TagOutlined />,
          //   label: 'Seller Coupons',
          // },
          {
            key: '/banners',
            icon: <PictureOutlined />,
            label: 'Banners',
          },
          {
            key: '/announcements',
            icon: <BellOutlined />,
            label: 'Announcements',
          },
          {
            key: '/blogs',
            icon: <EditOutlined />,
            label: 'Blogs',
          },
          {
            key: '/promotional-emails',
            icon: <MailOutlined />,
            label: 'Promotional Emails',
          },
          {
            key: '/reviews',
            icon: <StarOutlined />,
            label: 'Review Moderation',
          },
        ],
      },
      { type: 'divider' },

      // 7. Support & Communication
      {
        key: 'support',
        icon: <CustomerServiceOutlined />,
        label: 'Support & Communication',
        children: [
          {
            key: '/support/tickets',
            icon: <MessageOutlined />,
            label: 'Support Tickets',
          },
          {
            key: '/support/contact',
            icon: <FileTextOutlined />,
            label: 'Contact Forms',
          },
          {
            key: '/support/articles',
            icon: <QuestionCircleOutlined />,
            label: 'Help Articles',
          },
        ],
      },
      { type: 'divider' },

      // 8. System Settings
      {
        key: 'settings-group',
        icon: <SettingOutlined />,
        label: 'System Settings',
        children: [
          {
            key: '/settings',
            icon: <SettingOutlined />,
            label: 'Branding Settings',
          },
          {
            key: '/calculations',
            icon: <CalculatorOutlined />,
            label: 'Calculations & Formulas',
          },
          {
            key: '/settings/settlement',
            icon: <DollarOutlined />,
            label: 'Settlement Settings',
          },
          {
            key: '/settings?tab=sla',
            icon: <ClockCircleOutlined />,
            label: 'SLA / TAT Settings',
          },
          {
            key: '/roles',
            icon: <SafetyOutlined />,
            label: 'Role Management',
          },
          {
            key: '/users',
            icon: <UserOutlined />,
            label: 'User Management',
          },
          {
            key: '/agreements',
            icon: <FileTextOutlined />,
            label: 'Terms & Agreements',
          },
          {
            key: '/feedback',
            icon: <LikeOutlined />,
            label: 'User Feedback',
          },
          {
            key: '/guide',
            icon: <QuestionCircleOutlined />,
            label: 'Admin Guide',
          },
        ],
      },
      { type: 'divider' },

      // 9. Notifications
      {
        key: '/notifications',
        icon: <BellOutlined />,
        label: 'Notifications',
      },
      { type: 'divider' },

      // 10. Logout
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        danger: true,
      },
    ]

    if (role === 'super-admin') return items
    if (!permissions) {
      return [
        {
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: 'Dashboard',
        },
      ]
    }

    return items
      .map((item) => {
        if (!item || item.type === 'divider') return item

        if (item.key === 'logout') return item

        if ('children' in item && item.children) {
          const filteredChildren = item.children.filter(
            (child) =>
              child && 'key' in child && isRouteAccessible(permissions, child.key as string),
          )

          if (filteredChildren.length === 0) return null

          return { ...item, children: filteredChildren }
        }

        return item.key && isRouteAccessible(permissions, item.key as string) ? item : null
      })
      .filter(Boolean) as MenuItem[]
  }, [permissions, role])

  // Auto-open parent groups when route matches
  useEffect(() => {
    const path = location.pathname
    const keys: string[] = []

    // Notifications route
    if (path.startsWith('/notifications')) {
      // No parent group for notifications
    }

    // Users group routes
    if (path.startsWith('/sellers') || path.startsWith('/customers')) {
      keys.push('users-group')
    }

    // Settlements group routes
    if (path.startsWith('/settlements')) {
      keys.push('settlements-group')
    }

    // Reports group routes
    if (path.startsWith('/reports')) {
      keys.push('reports-group')
    }

    // Catalog group routes
    if (
      path.startsWith('/products') ||
      path.startsWith('/reviews') ||
      path.startsWith('/coupons') ||
      path.startsWith('/seller-coupons') ||
      path.startsWith('/categories') ||
      path.startsWith('/banners') ||
      path.startsWith('/blogs') ||
      path.startsWith('/promotional-emails')
    ) {
      keys.push('catalog-group')
    }

    // Settings group routes
    if (
      path.startsWith('/calculations') ||
      path.startsWith('/settings') ||
      path.startsWith('/agreements') ||
      path.startsWith('/roles') ||
      path.startsWith('/feedback')
    ) {
      keys.push('settings-group')
    }

    // Support group routes
    if (path.startsWith('/support')) {
      keys.push('support')
    }

    setOpenKeys(keys)
  }, [location.pathname])

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout()
      window.location.href = '/login'
      return
    }

    // Don't navigate for parent group items
    if (
      key === 'users-group' ||
      key === 'settlements-group' ||
      key === 'reports-group' ||
      key === 'catalog-group' ||
      key === 'settings-group' ||
      key === 'support'
    ) {
      return
    }

    navigate(key as string)
  }

  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys)
  }

  // Get selected keys based on current route
  const selectedKeys = useMemo(() => {
    const path = location.pathname
    const search = location.search

    // Normalize path (remove trailing slash except for root)
    const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
    const fullPath = normalizedPath + search

    // Flatten all menu keys (including children) to find match
    const getAllKeys = (items: MenuItem[]): string[] => {
      const keys: string[] = []

      for (const item of items) {
        if (!item || item.type === 'divider') continue

        if (item.key && typeof item.key === 'string') {
          keys.push(item.key)
        }

        if ('children' in item && item.children) {
          for (const child of item.children) {
            if (child && 'key' in child && typeof child.key === 'string') {
              keys.push(child.key)
            }
          }
        }
      }

      return keys
    }

    const allKeys = getAllKeys(menuItems)

    // Find exact match first (including query params)
    if (allKeys.includes(fullPath) || allKeys.includes(normalizedPath)) {
      return allKeys.includes(fullPath) ? [fullPath] : [normalizedPath]
    }

    // Find best matching key (for nested routes like /products/123)
    // Also handle query params by checking path without query
    const matchingKey = allKeys.find((key) => {
      const keyPath = key.split('?')[0]
      return (
        normalizedPath.startsWith(keyPath + '/') ||
        normalizedPath === keyPath ||
        normalizedPath === key
      )
    })

    return matchingKey ? [matchingKey] : []
  }, [location.pathname, location.search, menuItems])

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={240}
      className="!bg-gray-900 text-gray-100 border-none shadow-lg"
      style={{
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center py-6 border-b border-gray-800 px-4"
        style={{ flexShrink: 0 }}
      >
        {collapsed ? (
          <img src="/logo.png" alt="Kourier Boyz" className="h-8 w-auto object-contain" />
        ) : (
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Kourier Boyz" className="h-8 w-auto object-contain" />
            <div className="flex flex-col">
              <span className="font-bold text-xl text-white tracking-tight">Kourier Boyz</span>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {roleLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Menu - Scrollable container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
          maxHeight: 'calc(100vh - 140px)',
        }}
        onWheel={(e) => {
          // Ensure wheel events work
          e.stopPropagation()
        }}
      >
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          onClick={handleMenuClick}
          items={menuItems}
          className="!bg-transparent !border-none"
          style={{
            border: 'none',
            height: '100%',
          }}
        />
      </div>

      {/* Footer */}
      <div
        className="border-t border-gray-800 text-center py-3 text-xs text-gray-400"
        style={{ flexShrink: 0 }}
      >
        © {new Date().getFullYear()} <span className="font-semibold text-gray-500">Kourier Boyz</span>
      </div>
    </Sider>
  )
}

export default Sidebar
