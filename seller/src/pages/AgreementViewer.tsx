import { FilePdfOutlined } from '@ant-design/icons'
import { App, Button, Card, Spin, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAgreementByType } from '../api/agreementQueries'
import type { AgreementType } from '../api/agreements'

const { Title, Paragraph } = Typography

const AgreementViewer = () => {
  const { type } = useParams<{ type: AgreementType }>()
  const { message: messageApi } = App.useApp()
  const { data: agreement, isLoading, error } = useAgreementByType(type || null)
  const [showPdf, setShowPdf] = useState(false)

  useEffect(() => {
    if (error) {
      messageApi.error('Failed to load agreement')
    }
  }, [error, messageApi])

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (!agreement) {
    return (
      <Card>
        <Typography.Title level={4}>Agreement Not Found</Typography.Title>
        <Paragraph>The requested agreement could not be found.</Paragraph>
      </Card>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>{agreement.title}</Title>
          <Paragraph type="secondary">
            Version {agreement.version} | Effective Date:{' '}
            {agreement.effectiveDate
              ? new Date(agreement.effectiveDate).toLocaleDateString()
              : 'Not specified'}
          </Paragraph>
        </div>

        {agreement.pdfUrl && (
          <div style={{ marginBottom: 24 }}>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              onClick={() => setShowPdf(!showPdf)}
              style={{ marginBottom: 16 }}
            >
              {showPdf ? 'Hide PDF' : 'View PDF'}
            </Button>

            {showPdf && (
              <div style={{ marginTop: 16 }}>
                <iframe
                  src={agreement.pdfUrl}
                  style={{
                    width: '100%',
                    height: '800px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 4,
                  }}
                  title="Agreement PDF"
                />
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: showPdf ? 0 : 16,
            padding: 24,
            background: '#fafafa',
            borderRadius: 4,
            lineHeight: 1.8,
          }}
          dangerouslySetInnerHTML={{ __html: agreement.content }}
        />
      </Card>
    </div>
  )
}

export default AgreementViewer
