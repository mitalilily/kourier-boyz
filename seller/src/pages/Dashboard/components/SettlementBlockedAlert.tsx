import { WarningOutlined } from '@ant-design/icons'
import { Alert, Button, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { DashboardOverview } from '../../../api/dashboard'

const { Paragraph } = Typography

interface SettlementBlockedAlertProps {
  data: DashboardOverview | undefined
}

const SettlementBlockedAlert = ({ data }: SettlementBlockedAlertProps) => {
  const navigate = useNavigate()

  if (!data?.isSettlementBlocked) return null

  return (
    <Alert
      message="Settlement Blocked"
      description={
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Your settlement is currently blocked due to incomplete information:
          </Paragraph>
          <ul style={{ marginBottom: 8, paddingLeft: 20 }}>
            {data.blockingReasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
          <Button type="primary" onClick={() => navigate('/profile')}>
            Complete Setup
          </Button>
        </div>
      }
      type="warning"
      showIcon
      icon={<WarningOutlined />}
      closable
      style={{ marginBottom: 24 }}
    />
  )
}

export default SettlementBlockedAlert

