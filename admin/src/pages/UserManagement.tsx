import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { App, Card, Form, Input, Typography } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { useAssignRolesToUser, useRoles, useUserRoles } from '../api/roles'
import type { AllUserFilters } from '../api/users'
import {
  useAllUsers,
  useBlockAdminUser,
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
} from '../api/users'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'
import {
  AssignRolesModal,
  CreateUserModal,
  ResetPasswordModal,
  UserFilters,
  UserStatsCard,
  UserTable,
  ViewPermissionsModal,
} from '../components/userManagement'
import { useUserPermissions } from '../hooks/useUserPermissions'
import { useAuthStore } from '../store/authStore'
import type { UserManagementUser } from '../types/userManagement'
import {
  applyRoleFilters,
  calculateUserStats,
  filterAdminUsers,
  getRoleDisplayName,
} from '../utils/userManagement'

const { Title, Text } = Typography

const UserManagement = () => {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm()
  const deleteUser = useDeleteUser()
  const createUser = useCreateUser()
  const assignRoles = useAssignRolesToUser()
  const blockUser = useBlockAdminUser()
  const resetPassword = useResetUserPassword()
  const { data: allRoles } = useRoles()
  const currentUserId = useAuthStore((state) => state.userId)

  const [filters, setFilters] = useState<AllUserFilters>({})
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [permissionsModalVisible, setPermissionsModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [resetModalVisible, setResetModalVisible] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserManagementUser | null>(null)
  const [passwordUser, setPasswordUser] = useState<UserManagementUser | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  // Data fetching
  const { data: users, isLoading } = useAllUsers(filters)
  const { data: userRolesData } = useUserRoles(
    selectedUser?._id && (roleModalVisible || permissionsModalVisible) ? selectedUser._id : '',
  )
  const filteredUsers = useMemo(
    () => filterAdminUsers(users, currentUserId),
    [users, currentUserId],
  )

  const finalFilteredUsers = useMemo(
    () => applyRoleFilters(filteredUsers, selectedRoles),
    [filteredUsers, selectedRoles],
  )

  const userStats = useMemo(
    () => calculateUserStats(finalFilteredUsers, allRoles?.length || 0),
    [finalFilteredUsers, allRoles?.length],
  )

  const aggregatedPermissions = useUserPermissions(userRolesData, selectedUser?.role || '')

  useMemo(() => {
    if (userRolesData && selectedUser && roleModalVisible) {
      setSelectedRoleIds(userRolesData.map((r) => r._id))
    }
  }, [userRolesData, selectedUser, roleModalVisible])

  const handleDelete = useCallback(
    (id: string, name: string) => {
      modal.confirm({
        title: 'Delete User',
        content: `Are you sure you want to delete ${name}? This action cannot be undone.`,
        okText: 'Delete',
        okType: 'danger',
        onOk: () => {
          deleteUser.mutate(id, {
            onSuccess: () => message.success('User deleted successfully'),
            onError: (err: unknown) => {
              const error = err as { response?: { data?: { error?: string } } }
              message.error(error.response?.data?.error || 'Failed to delete user')
            },
          })
        },
      })
    },
    [modal, deleteUser, message],
  )

  const handleAssignRoles = useCallback(() => {
    if (!selectedUser) return

    assignRoles.mutate(
      {
        userId: selectedUser._id,
        roleIds: selectedRoleIds,
      },
      {
        onSuccess: () => {
          message.success('Roles assigned successfully')
          setRoleModalVisible(false)
          setSelectedUser(null)
          setSelectedRoleIds([])
        },
        onError: (err: unknown) => {
          const error = err as { response?: { data?: { error?: string } } }
          message.error(error.response?.data?.error || 'Failed to assign roles')
        },
      },
    )
  }, [selectedUser, selectedRoleIds, assignRoles, message])

  const handleCreateUser = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const normalizedEmail = values.email.trim().toLowerCase()
      const baseRole = values.role

      const duplicate = (users || []).find(
        (user: UserManagementUser) =>
          user.email?.toLowerCase() === normalizedEmail && user.role === baseRole,
      )

      if (duplicate) {
        message.error(
          `An account with this email already exists as ${getRoleDisplayName(baseRole)}.`,
        )
        return
      }

      createUser.mutate(
        {
          name: values.name,
          email: normalizedEmail,
          password: values.password,
          role: baseRole,
          phone: values.phone,
          roleIds: values.roleIds && values.roleIds.length > 0 ? values.roleIds : undefined,
        },
        {
          onSuccess: async (data) => {
            // Check if roles were assigned during creation
            if (data?.roles && data.roles.length > 0) {
              message.success(
                `User created and ${data.roles.length} role(s) assigned successfully`,
              )
            } else if (values.roleIds && values.roleIds.length > 0) {
              // If roles weren't assigned during creation, try to assign them now
              try {
                await assignRoles.mutateAsync({
                  userId: data._id,
                  roleIds: values.roleIds,
                })
                message.success('User created and roles assigned successfully')
              } catch (error) {
                const err = error as { response?: { data?: { error?: string } } }
                message.warning(
                  `User created successfully, but failed to assign roles: ${err.response?.data?.error || 'Unknown error'}. Please assign them manually.`,
                )
              }
            } else {
              message.warning(
                'User created successfully, but no roles were assigned. Please assign roles manually.',
              )
            }
            setCreateModalVisible(false)
            form.resetFields()
          },
          onError: (err: unknown) => {
            const error = err as { response?: { data?: { error?: string } } }
            message.error(error.response?.data?.error || 'Failed to create user')
          },
        },
      )
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }, [form, createUser, assignRoles, message])

  const handleViewPermissions = useCallback((user: UserManagementUser) => {
    setSelectedUser(user)
    setPermissionsModalVisible(true)
  }, [])

  const handleAssignRolesClick = useCallback((user: UserManagementUser) => {
    setSelectedUser(user)
    setSelectedRoleIds(user.roles?.map((r) => r._id) || [])
    setRoleModalVisible(true)
  }, [])

  const handleResetPasswordClick = useCallback((user: UserManagementUser) => {
    setPasswordUser(user)
    setResetModalVisible(true)
  }, [])

  const handleResetPasswordSubmit = useCallback(
    (newPassword: string) => {
      if (!passwordUser) return

      resetPassword.mutate(
        {
          id: passwordUser._id,
          password: newPassword,
        },
        {
          onSuccess: () => {
            message.success('Password reset successfully')
            setResetModalVisible(false)
            setPasswordUser(null)
          },
          onError: (err: unknown) => {
            const error = err as { response?: { data?: { error?: string } } }
            message.error(error.response?.data?.error || 'Failed to reset password')
          },
        },
      )
    },
    [passwordUser, resetPassword, message],
  )

  const handleBlock = useCallback(
    (user: UserManagementUser, isBlocked: boolean) => {
      if (user.role === 'super-admin' && currentUserId === user._id) {
        message.error('Cannot block yourself')
        return
      }

      if (isBlocked) {
        // For blocking, show a modal with input for reason
        let blockedReason = ''
        modal.confirm({
          title: 'Block User',
          content: (
            <div>
              <p style={{ marginBottom: 8 }}>Are you sure you want to block {user.name}?</p>
              <Input.TextArea
                placeholder="Enter reason for blocking (optional)"
                rows={3}
                onChange={(e) => (blockedReason = e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>
          ),
          okText: 'Block',
          okType: 'danger',
          onOk: () => {
            blockUser.mutate(
              {
                id: user._id,
                isBlocked: true,
                blockedReason: blockedReason || 'Account blocked by admin',
              },
              {
                onSuccess: () => {
                  message.success('User blocked successfully')
                },
                onError: (err: unknown) => {
                  const error = err as {
                    response?: { data?: { error?: string } }
                  }
                  message.error(error.response?.data?.error || 'Failed to block user')
                },
              },
            )
          },
        })
      } else {
        // For unblocking, simple confirmation
        modal.confirm({
          title: 'Unblock User',
          content: `Are you sure you want to unblock ${user.name}?`,
          okText: 'Unblock',
          onOk: () => {
            blockUser.mutate(
              {
                id: user._id,
                isBlocked: false,
              },
              {
                onSuccess: () => {
                  message.success('User unblocked successfully')
                },
                onError: (err: unknown) => {
                  const error = err as {
                    response?: { data?: { error?: string } }
                  }
                  message.error(error.response?.data?.error || 'Failed to unblock user')
                },
              },
            )
          },
        })
      }
    },
    [blockUser, message, modal, currentUserId],
  )

  return (
    <div>
      <Card className="rounded-lg">
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <UserOutlined className="text-blue-500 text-2xl" />
                <Title level={2} className="mb-0 text-2xl font-semibold">
                  User Management
                </Title>
              </div>
              <Text className="text-gray-500 text-sm leading-relaxed">
                Create and manage admin users for your team. Assign custom roles to control access
                and permissions.
              </Text>
            </div>
            <PermissionGate module="userManagement" permission="create">
              <PermissionButton
                module="userManagement"
                permission="create"
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
                className="h-10 rounded-md font-medium shadow-sm hover:shadow-md transition-shadow"
              >
                Create User
              </PermissionButton>
            </PermissionGate>
          </div>

          {/* Stats Card */}
          <UserStatsCard stats={userStats} />
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-gray-200" />

        {/* Filters Section */}
        <div className="mb-6">
          <UserFilters
            filters={filters}
            selectedRoles={selectedRoles}
            allRoles={allRoles}
            onFiltersChange={setFilters}
            onRolesChange={setSelectedRoles}
          />
        </div>

        {/* Table Section */}
        <Card size="small" className="border border-gray-200 rounded-md">
          <UserTable
            users={finalFilteredUsers}
            isLoading={isLoading}
            onViewPermissions={handleViewPermissions}
            onAssignRoles={handleAssignRolesClick}
            onResetPassword={handleResetPasswordClick}
            onDelete={handleDelete}
            onBlock={handleBlock}
            isDeleting={deleteUser.isPending}
            isBlocking={blockUser.isPending}
          />
        </Card>
      </Card>

      {/* Modals */}
      <CreateUserModal
        open={createModalVisible}
        form={form}
        allRoles={allRoles}
        loading={createUser.isPending || assignRoles.isPending}
        onCancel={() => {
          setCreateModalVisible(false)
          form.resetFields()
        }}
        onSubmit={handleCreateUser}
      />

      <AssignRolesModal
        open={roleModalVisible}
        user={selectedUser}
        selectedRoleIds={selectedRoleIds}
        allRoles={allRoles}
        loading={assignRoles.isPending}
        onCancel={() => {
          setRoleModalVisible(false)
          setSelectedUser(null)
          setSelectedRoleIds([])
        }}
        onOk={handleAssignRoles}
        onRoleIdsChange={setSelectedRoleIds}
      />

      <ViewPermissionsModal
        open={permissionsModalVisible}
        user={selectedUser}
        userRoles={userRolesData}
        aggregatedPermissions={aggregatedPermissions}
        onCancel={() => {
          setPermissionsModalVisible(false)
          setSelectedUser(null)
        }}
      />

      <ResetPasswordModal
        open={resetModalVisible}
        user={passwordUser}
        loading={resetPassword.isPending}
        onCancel={() => {
          setResetModalVisible(false)
          setPasswordUser(null)
        }}
        onSubmit={handleResetPasswordSubmit}
      />
    </div>
  )
}

export default UserManagement
