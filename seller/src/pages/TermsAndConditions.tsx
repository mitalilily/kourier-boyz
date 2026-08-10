import { FilePdfOutlined } from '@ant-design/icons'
import { App, Button, Card, Spin, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useAgreementByType } from '../api/agreementQueries'

const { Title, Paragraph } = Typography

const TermsAndConditions = () => {
  const { message: messageApi } = App.useApp()
  const { data: agreement, isLoading, error } = useAgreementByType('seller-agreement')
  const [showPdf, setShowPdf] = useState(false)

  useEffect(() => {
    if (agreement) {
      document.title = agreement.title || 'Terms & Conditions'
    } else {
      document.title = 'Terms & Conditions'
    }
  }, [agreement])

  useEffect(() => {
    if (error) {
      messageApi.error('Failed to load terms and conditions')
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
        <Title level={4}>Terms & Conditions Not Found</Title>
        <Paragraph>
          The seller terms and conditions could not be found. Please contact support if this issue persists.
        </Paragraph>
      </Card>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>Seller Terms & Agreement</Title>
          <Paragraph type="secondary">
            Version {agreement.version} | Effective Date:{' '}
            {agreement.effectiveDate
              ? new Date(agreement.effectiveDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Not specified'}
            {agreement.updatedAt && (
              <>
                {' '}
                | Last Updated:{' '}
                {new Date(agreement.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </>
            )}
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
              {showPdf ? 'Hide PDF' : 'View PDF Version'}
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
                  title="Terms & Conditions PDF"
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

export default TermsAndConditions

