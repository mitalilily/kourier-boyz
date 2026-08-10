import { Alert, Form, Input, Modal, Typography } from "antd";
import { useEffect } from "react";
import type { UserManagementUser } from "../../types/userManagement";

const { Paragraph, Text } = Typography;

interface ResetPasswordModalProps {
  open: boolean;
  user: UserManagementUser | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}

export const ResetPasswordModal = ({
  open,
  user,
  loading,
  onCancel,
  onSubmit,
}: ResetPasswordModalProps) => {
  const [form] = Form.useForm<{ password: string; confirmPassword: string }>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values.password);
      form.resetFields();
    } catch {
      // validation errors handled by form
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      open={open}
      title={`Reset password${user ? ` • ${user.name}` : ""}`}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="Reset Password"
      okButtonProps={{ loading, disabled: loading }}
      destroyOnClose
    >
      <div className="space-y-4">
        <Alert
          type="warning"
          showIcon
          message="This action immediately overrides the user's existing password."
          description="Share the new password with the user securely. They will be able to log in right away."
        />
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            <Text strong>Email</Text>
            <br />
            <Text type="secondary">{user?.email}</Text>
          </Paragraph>
        </div>
        <Form form={form} layout="vertical">
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: "Please enter a password" },
              {
                min: 8,
                message: "Password must be at least 8 characters long",
              },
            ]}
          >
            <Input.Password placeholder="Enter new password" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm the password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("Passwords do not match")
                  );
                },
              }),
            ]}
          >
            <Input.Password placeholder="Re-enter new password" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};

