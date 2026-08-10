import { InfoCircleOutlined } from '@ant-design/icons'
import { Alert, Collapse, Typography } from 'antd'

const { Text, Paragraph } = Typography

interface CertificateApprovalFlowInfoProps {
  compact?: boolean
}

const CertificateApprovalFlowInfo = ({ compact = false }: CertificateApprovalFlowInfoProps) => {
  if (compact) {
    return (
      <Alert
        type="info"
        icon={<InfoCircleOutlined />}
        message="Approval Flow"
        description={
          <div style={{ marginTop: 8 }}>
            <Text strong>When you approve this product:</Text>
            <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 20 }}>
              <li>Pending certificates are auto-approved</li>
              <li>Related products from this seller are also auto-approved</li>
              <li>Seller receives notification</li>
            </ul>
          </div>
        }
        showIcon
        style={{ marginBottom: 16 }}
      />
    )
  }

  return (
    <Alert
      type="info"
      icon={<InfoCircleOutlined />}
      message="Certificate-Product Approval Flow"
      description={
        <div style={{ marginTop: 8 }}>
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: '1',
                label: <Text strong>What happens when you approve a product?</Text>,
                children: (
                  <div style={{ paddingLeft: 8 }}>
                    <Paragraph style={{ marginBottom: 8 }}>
                      <Text strong>Auto-Approval Cascade:</Text>
                    </Paragraph>
                    <ul style={{ marginBottom: 8, paddingLeft: 20 }}>
                      <li>
                        <Text>Pending certificates linked to this product are automatically approved</Text>
                      </li>
                      <li>
                        <Text>
                          All other products from <Text strong>this seller</Text> using the same certificates are
                          auto-approved
                        </Text>
                      </li>
                      <li>
                        <Text>
                          Products in related categories (parent/child) are also checked and auto-approved
                        </Text>
                      </li>
                      <li>
                        <Text>The seller receives an email notification</Text>
                      </li>
                    </ul>
                    <Paragraph style={{ marginBottom: 0, marginTop: 8 }}>
                      <Text type="secondary" italic>
                        💡 Tip: Approving one product can activate multiple products for this seller if they share
                        the same certificates.
                      </Text>
                    </Paragraph>
                  </div>
                ),
              },
              {
                key: '2',
                label: <Text strong>Certificate expiration handling</Text>,
                children: (
                  <div style={{ paddingLeft: 8 }}>
                    <Paragraph style={{ marginBottom: 8 }}>
                      When a certificate expires:
                    </Paragraph>
                    <ul style={{ marginBottom: 8, paddingLeft: 20 }}>
                      <li>
                        <Text>All products using that certificate are moved to pending approval</Text>
                      </li>
                      <li>
                        <Text>Seller and admin are notified</Text>
                      </li>
                      <li>
                        <Text>
                          After seller uploads a renewed certificate, approve any product to reactivate all
                          related products
                        </Text>
                      </li>
                    </ul>
                  </div>
                ),
              },
              {
                key: '3',
                label: <Text strong>Seller-specific isolation</Text>,
                children: (
                  <div style={{ paddingLeft: 8 }}>
                    <Paragraph style={{ marginBottom: 0 }}>
                      <Text>
                        All operations are seller-specific. Approving Seller A's product will{' '}
                        <Text strong>never</Text> affect Seller B's products. Complete data isolation is
                        maintained.
                      </Text>
                    </Paragraph>
                  </div>
                ),
              },
            ]}
          />
        </div>
      }
      showIcon
      style={{ marginBottom: 16 }}
    />
  )
}

export default CertificateApprovalFlowInfo

