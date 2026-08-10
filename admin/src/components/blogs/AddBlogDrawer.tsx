import { UploadOutlined } from "@ant-design/icons";
import type { DrawerProps, UploadFile } from "antd";
import { DatePicker, Drawer, Form, Input, Select, Upload, message } from "antd";
import dayjs from "dayjs";
import React, { useEffect, useRef, useState } from "react";
import { useCreateBlog, useUpdateBlog } from "../../api/blogs";
import RichTextEditor from "../RichTextEditor";
import type { Blog } from "../../types/blog";
import { BLOG_STATUSES } from "../../types/blog";
import { toast } from "sonner";

const { TextArea } = Input;

interface AddBlogDrawerProps extends DrawerProps {
  onAdd?: (formData: FormData, form: { resetFields: () => void }) => void;
  editingBlog?: Blog | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
];

// Generate slug from title (matches backend logic)
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
};

const AddBlogDrawer: React.FC<AddBlogDrawerProps> = ({
  open,
  onClose,
  editingBlog,
}) => {
  const [form] = Form.useForm();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const prevBlobRef = useRef<string | null>(null);
  const [drawerWidth, setDrawerWidth] = useState<number | string>("100%");
  const slugManuallyEdited = useRef(false);

  const createBlog = useCreateBlog();
  const updateBlog = useUpdateBlog();

  const isEditing = !!editingBlog;

  useEffect(() => {
    if (typeof window === "undefined") {
      setDrawerWidth("100%");
      return;
    }

    const updateWidth = () => {
      const viewport = window.innerWidth;
      if (viewport >= 1440) {
        setDrawerWidth(1280);
      } else if (viewport >= 1200) {
        setDrawerWidth(1100);
      } else if (viewport >= 1024) {
        setDrawerWidth(960);
      } else {
        setDrawerWidth("100%");
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (prevBlobRef.current) {
        try {
          URL.revokeObjectURL(prevBlobRef.current);
        } catch (error) {
          console.warn("Failed to revoke preview URL", error);
        }
        prevBlobRef.current = null;
      }
    };
  }, []);

  // Prefill form when editing
  useEffect(() => {
    if (isEditing && editingBlog) {
      form.setFieldsValue({
        title: editingBlog.title,
        slug: editingBlog.slug,
        content: editingBlog.content,
        excerpt: editingBlog.excerpt,
        status: editingBlog.status,
        publishedAt: editingBlog.publishedAt
          ? dayjs(editingBlog.publishedAt)
          : undefined,
        tags: editingBlog.tags?.join(", ") || "",
        categories: editingBlog.categories?.join(", ") || "",
        metaTitle: editingBlog.metaTitle,
        metaDescription: editingBlog.metaDescription,
        seoKeywords: editingBlog.seoKeywords?.join(", ") || "",
      });
      slugManuallyEdited.current = true; // Preserve existing slug when editing

      // Set file list and preview from existing image
      if (editingBlog.featuredImage) {
        setFileList([
          {
            uid: "-1",
            name: "Current Image",
            status: "done",
            url: editingBlog.featuredImage,
          },
        ]);
        setPreviewUrl(editingBlog.featuredImage);
      } else {
        setFileList([]);
        setPreviewUrl(null);
      }
    } else {
      form.resetFields();
      setFileList([]);
      setPreviewUrl(null);
      setImageFile(null);
      slugManuallyEdited.current = false; // Reset when creating new blog
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingBlog, isEditing, open]);

  // Watch title field to auto-generate slug
  const titleValue = Form.useWatch('title', form);

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEditing && titleValue && !slugManuallyEdited.current) {
      const generatedSlug = generateSlug(titleValue);
      const currentSlug = form.getFieldValue('slug');
      
      // Only update if slug is empty or matches what would be generated
      if (!currentSlug || currentSlug === generateSlug(titleValue)) {
        form.setFieldsValue({ slug: generatedSlug });
      }
    }
  }, [titleValue, form, isEditing]);

  const handleBeforeUpload = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error(
        "Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed."
      );
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      message.error("File too large. Maximum size is 10MB.");
      return false;
    }

    const fileURL = URL.createObjectURL(file);

    if (prevBlobRef.current) {
      try {
        URL.revokeObjectURL(prevBlobRef.current);
      } catch (error) {
        console.warn("Failed to revoke preview URL", error);
      }
    }

    prevBlobRef.current = fileURL;
    setPreviewUrl(fileURL);

    const uniqueUid = `${Date.now()}-${file.name}`;
    setImageFile(file);
    setFileList([
      {
        uid: uniqueUid,
        name: file.name,
        status: "done",
        url: fileURL,
      },
    ]);

    return false; // prevent auto upload
  };

  const handleRemove = () => {
    setFileList([]);
    setImageFile(null);
    if (prevBlobRef.current) {
      try {
        URL.revokeObjectURL(prevBlobRef.current);
      } catch (error) {
        console.warn("Failed to revoke preview URL", error);
      }
      prevBlobRef.current = null;
    }
    setPreviewUrl(null);
  };

  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        const formData = new FormData();
        formData.append("title", values.title);
        // Only send slug if it has a value, otherwise backend will auto-generate
        if (values.slug && values.slug.trim()) {
          formData.append("slug", values.slug.trim());
        } else {
          formData.append("slug", ""); // Empty string triggers backend auto-generation
        }
        formData.append("content", values.content || "");
        if (values.excerpt) formData.append("excerpt", values.excerpt);
        formData.append("status", values.status || "draft");
        if (values.publishedAt) {
          formData.append("publishedAt", values.publishedAt.toISOString());
        }
        if (values.tags) {
          formData.append("tags", values.tags);
        }
        if (values.categories) {
          formData.append("categories", values.categories);
        }
        if (values.metaTitle) formData.append("metaTitle", values.metaTitle);
        if (values.metaDescription)
          formData.append("metaDescription", values.metaDescription);
        if (values.seoKeywords)
          formData.append("seoKeywords", values.seoKeywords);

        if (imageFile) formData.append("featuredImage", imageFile);

        if (isEditing && editingBlog?._id) {
          updateBlog.mutate(
            { id: editingBlog._id, formData },
            {
              onSuccess: () => {
                toast.success("Blog updated successfully!");
                onClose?.({} as React.MouseEvent<HTMLElement>);
              },
              onError: () => toast.error("Failed to update blog"),
            }
          );
        } else {
          createBlog.mutate(formData, {
            onSuccess: () => {
              toast.success("Blog created successfully!");
              onClose?.({} as React.MouseEvent<HTMLElement>);
            },
            onError: () => toast.error("Failed to create blog"),
          });
        }
      })
      .catch(() => message.error("Please fill in all required fields"));
  };

  return (
    <Drawer
      title={isEditing ? "Edit Blog" : "Add Blog"}
      placement="right"
      onClose={onClose}
      open={open}
      width={drawerWidth}
      bodyStyle={{ padding: "0 32px 32px", maxWidth: 1440, margin: "0 auto" }}
      styles={{ header: { padding: "16px 32px" } }}
      extra={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            disabled={createBlog.isPending || updateBlog.isPending}
            style={{
              padding: "6px 24px",
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
              background: "white",
              cursor:
                createBlog.isPending || updateBlog.isPending
                  ? "not-allowed"
                  : "pointer",
              opacity: createBlog.isPending || updateBlog.isPending ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createBlog.isPending || updateBlog.isPending}
            style={{
              padding: "6px 24px",
              border: "none",
              borderRadius: "6px",
              background: "#1890ff",
              color: "white",
              cursor:
                createBlog.isPending || updateBlog.isPending
                  ? "not-allowed"
                  : "pointer",
              opacity: createBlog.isPending || updateBlog.isPending ? 0.6 : 1,
            }}
          >
            {createBlog.isPending || updateBlog.isPending
              ? isEditing
                ? "Updating..."
                : "Creating..."
              : isEditing
              ? "Update"
              : "Create"}
          </button>
        </div>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ status: "draft" }}>
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: "Please enter a title" }]}
        >
          <Input placeholder="Enter blog title" />
        </Form.Item>

        <Form.Item
          name="slug"
          label="Slug (URL-friendly identifier)"
          tooltip="Auto-generated from title. Leave empty to auto-generate, or customize as needed."
        >
          <Input 
            placeholder="Auto-generated from title (optional)" 
            onChange={(e) => {
              // Mark as manually edited if user types something
              if (e.target.value) {
                slugManuallyEdited.current = true;
              }
            }}
          />
        </Form.Item>

        <Form.Item
          name="excerpt"
          label="Excerpt (Short description)"
          rules={[
            { max: 300, message: "Excerpt should not exceed 300 characters" },
          ]}
        >
          <TextArea
            rows={3}
            placeholder="A brief summary of the blog post (optional, max 300 characters)"
            showCount
            maxLength={300}
          />
        </Form.Item>

        <Form.Item
          name="content"
          label="Content"
          rules={[{ required: true, message: "Please enter blog content" }]}
        >
          <RichTextEditor placeholder="Write your blog content here..." />
        </Form.Item>

        <Form.Item
          label={
            isEditing ? "Change Featured Image (optional)" : "Featured Image"
          }
          rules={isEditing ? [] : [{ required: false }]}
        >
          <Upload
            beforeUpload={handleBeforeUpload}
            maxCount={1}
            listType="picture-card"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
            fileList={fileList}
            onRemove={() => {
              handleRemove();
              return false;
            }}
          >
            {fileList.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <UploadOutlined />
                <span>Upload</span>
              </div>
            )}
          </Upload>
          {previewUrl && (
            <div style={{ marginTop: 16 }}>
              <img
                src={previewUrl}
                alt="Preview"
                style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8 }}
              />
            </div>
          )}
          <p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
            Max size: 10MB. Formats: JPEG, PNG, GIF, WebP, AVIF
          </p>
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          rules={[{ required: true, message: "Please select a status" }]}
        >
          <Select placeholder="Select status">
            {BLOG_STATUSES.map((status) => (
              <Select.Option key={status.value} value={status.value}>
                {status.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="publishedAt" label="Published Date (optional)">
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="tags" label="Tags (comma-separated)">
          <Input placeholder="e.g., technology, web development, tutorial" />
        </Form.Item>

        <Form.Item name="categories" label="Categories (comma-separated)">
          <Input placeholder="e.g., Tech, Business, Lifestyle" />
        </Form.Item>

        <Form.Item name="metaTitle" label="SEO Meta Title (optional)">
          <Input placeholder="SEO title for search engines" />
        </Form.Item>

        <Form.Item
          name="metaDescription"
          label="SEO Meta Description (optional)"
        >
          <TextArea
            rows={2}
            placeholder="SEO description for search engines"
            showCount
            maxLength={160}
          />
        </Form.Item>

        <Form.Item
          name="seoKeywords"
          label="SEO Keywords (comma-separated, optional)"
        >
          <Input placeholder="e.g., blog, tutorial, guide" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default AddBlogDrawer;
