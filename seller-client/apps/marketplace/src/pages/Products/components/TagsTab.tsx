import { Card, Form, Select, Typography } from 'antd'
import { SUGGESTED_TAGS } from '../../../utils/categoryAttributes'

const { Text } = Typography

interface TagsTabProps {
  tags: string[]
  setTags: (tags: string[]) => void
}

const TagsTab = ({ tags, setTags }: TagsTabProps) => {
  return (
    <Card title="Tags" style={{ marginBottom: 16 }}>
      <Form.Item label="Tags">
        <Select
          mode="tags"
          style={{ width: '100%' }}
          placeholder="Add tags like 'eco', 'summer', 'best seller'"
          value={tags}
          onChange={setTags}
          options={SUGGESTED_TAGS.map((t: string) => ({ value: t, label: t }))}
        />
      </Form.Item>
      <Text type="secondary">
        Add concise, relevant tags. These are used for filters and search alongside your variant
        attributes (e.g., color, size), helping customers find the right products quickly.
      </Text>
    </Card>
  )
}

export default TagsTab
