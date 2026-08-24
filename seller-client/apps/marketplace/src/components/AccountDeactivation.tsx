import { ExclamationCircleOutlined, PoweroffOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Form, Input, Modal, Space, Typography } from 'antd'
import { useState } from 'react'
import { checkDeactivationEligibility, requestDeactivation } from '../api/deactivation'
import { useProfile } from '../api/profileQueries'
import { useAuthStore } from '../store/authStore'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

const AccountDeactivation = () => {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [showRequestModal, setShowRequestModal] = useState(false)
  const user = useAuthStore((state) => state.user)
  const { refetch: refetchProfile } = useProfile()

  // Check eligibility
  const { data: eligibilityData, isLoading: checkingEligibility } = useQuery({
    queryKey: ['deactivationEligibility'],
    queryFn: checkDeactivationEligibility,
    enabled: user?.sellerLifecycleStatus === 'ACTIVE' || !user?.sellerLifecycleStatus, // Also check if status is undefined/null (defaults to ACTIVE)
  })

  const requestDeactivationMutation = useMutation({
    mutationFn: requestDeactivation,
    onSuccess: async (data) => {
      message.success(data.message || 'Deactivation request submitted successfully')
      setShowRequestModal(false)
      form.resetFields()

      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['deactivationEligibility'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })

      // Refetch profile to get updated user data and update auth store
      const profileResult = await refetchProfile()
      if (profileResult?.data) {
        const setUser = useAuthStore.getState().setUser
        setUser(profileResult.data)
      }
    },
    onError: (error: unknown) => {
      const axiosError = error as {
        response?: { data?: { error?: string; message?: string; blockingReasons?: string[] } }
      }
      const errorMessage =
        axiosError?.response?.data?.error ||
        axiosError?.response?.data?.message ||
        'Failed to submit request'
      const blockingReasons = axiosError?.response?.data?.blockingReasons || []

      if (blockingReasons.length > 0) {
        modal.error({
          title: 'Cannot Request Deactivation',
          content: (
            <div>
              <Paragraph strong>Please resolve the following issues:</Paragraph>
              <ul>
                {blockingReasons.map((reason: string, index: number) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          ),
        })
      } else {
        message.error(errorMessage)
      }
    },
  })

  const handleRequestDeactivation = async (values: { deactivationReason?: string }) => {
    await requestDeactivationMutation.mutateAsync({
      deactivationReason: values.deactivationReason,
    })
  }

  const showConfirmModal = () => {
    modal.confirm({
      title: 'Request Account Deactivation',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <Paragraph>
            Are you sure you want to request account deactivation? This action will:
          </Paragraph>
          <ul>
            <li>Unlist all your products from the marketplace</li>
            <li>Block new orders from being placed</li>
            <li>Make your account read-only until admin reviews your request</li>
            <li>Require admin approval before deactivation is finalized</li>
          </ul>
          <Paragraph strong style={{ marginTop: 16 }}>
            You can still view invoices and settlement information after deactivation.
          </Paragraph>
        </div>
      ),
      okText: 'Continue',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => {
        setShowRequestModal(true)
      },
    })
  }

  // Show status based on lifecycle status
  if (user?.sellerLifecycleStatus === 'DEACTIVATION_REQUESTED') {
    return (
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="Deactivation Request Pending"
            description={
              <div>
                <Paragraph>
                  Your deactivation request is under review by our admin team. You will be notified
                  once a decision is made.
                </Paragraph>
                {user.deactivationRequestedAt && (
                  <Text type="secondary">
                    Requested on:{' '}
                    {new Date(user.deactivationRequestedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                )}
                {user.deactivationReason && (
                  <div style={{ marginTop: 12 }}>
                    <Text strong>Reason: </Text>
                    <Text>{user.deactivationReason}</Text>
                  </div>
                )}
              </div>
            }
            type="warning"
            showIcon
          />
        </Space>
      </Card>
    )
  }

  if (user?.sellerLifecycleStatus === 'DEACTIVATED') {
    return (
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="Account Deactivated"
            description={
              <div>
                <Paragraph>
                  Your account has been deactivated. You can still view invoices and settlement
                  information, but you cannot list products or receive new orders.
                </Paragraph>
                {user.deactivatedAt && (
                  <Text type="secondary">
                    Deactivated on:{' '}
                    {new Date(user.deactivatedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                )}
                <Paragraph style={{ marginTop: 16 }}>
                  To reactivate your account, please contact admin support.
                </Paragraph>
              </div>
            }
            type="error"
            showIcon
          />
        </Space>
      </Card>
    )
  }

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={4}>
            <PoweroffOutlined /> Account Deactivation
          </Title>
          <Paragraph type="secondary">
            If you wish to deactivate your seller account, you can submit a deactivation request.
            Your request will be reviewed by our admin team.
          </Paragraph>
        </div>

        {eligibilityData &&
          !eligibilityData.eligible &&
          eligibilityData.blockingReasons.length > 0 && (
            <Alert
              message="Cannot Request Deactivation"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  {eligibilityData.blockingReasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              }
              type="error"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

        <Alert
          message="Before Requesting Deactivation"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>Complete all pending orders</li>
              <li>Resolve any active returns or replacements</li>
              <li>Ensure your ledger balance is zero</li>
              <li>Wait for any pending settlements to complete</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Button
          type="primary"
          danger
          size="large"
          icon={<PoweroffOutlined />}
          onClick={() => {
            if (eligibilityData && !eligibilityData.eligible) {
              // Show blocking reasons if not eligible
              modal.error({
                title: 'Cannot Request Deactivation',
                content: (
                  <div>
                    <Paragraph strong>Please resolve the following issues:</Paragraph>
                    <ul>
                      {eligibilityData.blockingReasons.map((reason: string, index: number) => (
                        <li key={index}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ),
              })
              return
            }
            showConfirmModal()
          }}
          loading={checkingEligibility}
          disabled={checkingEligibility}
        >
          Request Account Deactivation
        </Button>

        <Modal
          title="Request Account Deactivation"
          open={showRequestModal}
          onCancel={() => {
            setShowRequestModal(false)
            form.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleRequestDeactivation}
            style={{ marginTop: 24 }}
          >
            <Alert
              message="Important Information"
              description="After submitting your request, all products will be unlisted and new orders will be blocked. Your account will become read-only until admin reviews your request."
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form.Item
              name="deactivationReason"
              label="Reason for Deactivation (Optional)"
              tooltip="Help us understand why you're leaving. This information will be reviewed by our team."
            >
              <TextArea
                rows={4}
                placeholder="e.g., Business closure, switching to another platform, etc."
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space>
                <Button
                  type="primary"
                  danger
                  htmlType="submit"
                  loading={requestDeactivationMutation.isPending}
                  icon={<PoweroffOutlined />}
                >
                  Submit Request
                </Button>
                <Button
                  onClick={() => {
                    setShowRequestModal(false)
                    form.resetFields()
                  }}
                  disabled={requestDeactivationMutation.isPending}
                >
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </Card>
  )
}

export default AccountDeactivation
