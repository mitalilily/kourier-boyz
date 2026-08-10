import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button, Dropdown, Space } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect } from 'react'

interface RichTextEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  readOnly?: boolean
  showPlaceholders?: boolean // Show placeholder selector for email templates
}

// Available placeholders for email templates
const EMAIL_PLACEHOLDERS = [
  { label: 'First Name', value: '[First Name]', description: 'Recipient\'s first name' },
  { label: 'Full Name', value: '[Full Name]', description: 'Recipient\'s full name' },
  { label: 'Email', value: '[Email]', description: 'Recipient\'s email address' },
  { label: 'Shop Now Button', value: '[Shop Now Button]', description: 'Styled button linking to shop' },
  { label: 'Explore Button', value: '[Explore Button]', description: 'Styled button linking to explore page' },
  { label: 'Unsubscribe Link', value: '[Unsubscribe Link]', description: 'Unsubscribe link' },
]

const RichTextEditor = ({ value, onChange, placeholder, readOnly, showPlaceholders = false }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image,
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (onChange && html !== value) {
        onChange(html)
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
        style: readOnly ? 'background-color: #f5f5f5;' : 'background-color: #fff;',
        'data-placeholder': placeholder || '',
      },
    },
  })

  // Update editor content when value prop changes externally (but not during user edits)
  useEffect(() => {
    if (editor && value !== undefined && editor.getHTML() !== value) {
      const isFocused = editor.isFocused
      editor.commands.setContent(value || '')
      if (isFocused) {
        // Restore cursor position if it was focused
        editor.commands.focus()
      }
    }
  }, [editor, value])

  if (!editor) {
    return <div style={{ minHeight: 300, padding: 16 }}>Loading editor...</div>
  }

  if (readOnly) {
    return (
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          minHeight: 300,
          backgroundColor: '#f5f5f5',
          padding: 16,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    )
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const insertPlaceholder = (placeholder: string) => {
    editor.chain().focus().insertContent(placeholder).run()
  }

  const placeholderMenuItems: MenuProps['items'] = EMAIL_PLACEHOLDERS.map((ph) => ({
    key: ph.value,
    label: (
      <div>
        <div style={{ fontWeight: 500 }}>{ph.label}</div>
        <div style={{ fontSize: 12, color: '#999' }}>{ph.description}</div>
      </div>
    ),
    onClick: () => insertPlaceholder(ph.value),
  }))

  return (
    <div>
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderBottom: 'none',
          borderRadius: '4px 4px 0 0',
          padding: '8px 12px',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        <Space size="small" wrap>
          <Button
            type={editor.isActive('bold') ? 'primary' : 'default'}
            size="small"
            icon={<BoldOutlined />}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <Button
            type={editor.isActive('italic') ? 'primary' : 'default'}
            size="small"
            icon={<ItalicOutlined />}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <Button
            type={editor.isActive('underline') ? 'primary' : 'default'}
            size="small"
            icon={<UnderlineOutlined />}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <Button
            type={editor.isActive('strike') ? 'primary' : 'default'}
            size="small"
            icon={<StrikethroughOutlined />}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />

          <div style={{ width: 1, height: 24, backgroundColor: '#d9d9d9', margin: '0 4px' }} />

          <select
            value={editor.getAttributes('heading').level || ''}
            onChange={(e) => {
              const level = e.target.value ? parseInt(e.target.value) : 0
              if (level === 0) {
                editor.chain().focus().setParagraph().run()
              } else {
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
                  .run()
              }
            }}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d9d9d9' }}
          >
            <option value="">Normal</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="4">Heading 4</option>
            <option value="5">Heading 5</option>
            <option value="6">Heading 6</option>
          </select>

          <div style={{ width: 1, height: 24, backgroundColor: '#d9d9d9', margin: '0 4px' }} />

          <Button
            type={editor.isActive('bulletList') ? 'primary' : 'default'}
            size="small"
            icon={<UnorderedListOutlined />}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <Button
            type={editor.isActive('orderedList') ? 'primary' : 'default'}
            size="small"
            icon={<OrderedListOutlined />}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />

          <div style={{ width: 1, height: 24, backgroundColor: '#d9d9d9', margin: '0 4px' }} />

          <Button
            type={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
            size="small"
            icon={<AlignLeftOutlined />}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Align Left"
          />
          <Button
            type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
            size="small"
            icon={<AlignCenterOutlined />}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Align Center"
          />
          <Button
            type={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
            size="small"
            icon={<AlignRightOutlined />}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Align Right"
          />

          <div style={{ width: 1, height: 24, backgroundColor: '#d9d9d9', margin: '0 4px' }} />

          <Button size="small" icon={<LinkOutlined />} onClick={addLink} title="Add Link" />
          <Button size="small" onClick={addImage} title="Add Image">
            Img
          </Button>

          {showPlaceholders && (
            <>
              <div style={{ width: 1, height: 24, backgroundColor: '#d9d9d9', margin: '0 4px' }} />
              <Dropdown menu={{ items: placeholderMenuItems }} trigger={['click']}>
                <Button size="small" icon={<UserOutlined />} title="Insert Placeholder">
                  Placeholders
                </Button>
              </Dropdown>
            </>
          )}

          <div style={{ width: 1, height: 24, backgroundColor: '#d9d9d9', margin: '0 4px' }} />

          <Button
            size="small"
            icon={<UndoOutlined />}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          />
          <Button
            size="small"
            icon={<RedoOutlined />}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          />
        </Space>
      </div>
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: '0 0 4px 4px',
          minHeight: 300,
          backgroundColor: '#fff',
          position: 'relative',
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export default RichTextEditor
