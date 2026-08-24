import { useAuth } from '../../context/auth/AuthContext'

const getEmployeeOrderAccess = (moduleAccess: Record<string, any> | null | undefined) => {
  if (!moduleAccess || typeof moduleAccess !== 'object') return {}
  const ordersAccess = moduleAccess.orders
  return ordersAccess && typeof ordersAccess === 'object' ? ordersAccess : {}
}

export const useEmployeePermissions = () => {
  const { user } = useAuth()

  const isEmployee = user.role === 'employee'
  const orderAccess = getEmployeeOrderAccess(user.moduleAccess as Record<string, any> | null)

  const allowForNonEmployees = (value: boolean | undefined) =>
    isEmployee ? value === true : true

  return {
    isEmployee,
    employeeRole: user.employeeRole ?? null,
    employeeIsActive: user.employeeIsActive ?? null,
    canCancelOrders: allowForNonEmployees(orderAccess.cancelOrders),
    canExportOrders: allowForNonEmployees(orderAccess.exportOrders),
    canExportCustomerDetails: allowForNonEmployees(orderAccess.exportCustomerDetails),
    canViewCustomerDetails: allowForNonEmployees(orderAccess.viewCustomerDetails),
    canChangePaymentMode: allowForNonEmployees(orderAccess.changePaymentMode),
  }
}

export default useEmployeePermissions
