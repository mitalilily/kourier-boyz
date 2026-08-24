import { Card, Col, Form, Input, Row, Select } from 'antd'

const { TextArea } = Input

const SEOTab = () => {
  return (
    <Card title="SEO" style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="metaTitle" label="Meta Title" tooltip="Recommended up to 60 characters">
            <Input placeholder="Enter SEO title" maxLength={60} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="seoKeywords" label="SEO Keywords">
            <Select mode="tags" placeholder="Add SEO keywords" />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item
            name="metaDescription"
            label="Meta Description"
            tooltip="Recommended 120-160 characters"
          >
            <TextArea rows={3} maxLength={160} placeholder="Enter SEO description" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  )
}

export default SEOTab
