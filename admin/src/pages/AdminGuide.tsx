import {
  BookOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  LockOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import {
  Card,
  Collapse,
  Divider,
  Space,
  Tag,
  Typography,
  Alert,
  Table,
  List,
  Badge,
  Descriptions,
} from "antd";
import { MODULE_NAMES } from "../config/roles";
import { PERMISSIONS, PERMISSION_COLORS } from "../config/roles";
import type { Permission } from "../api/roles";

const { Title, Paragraph, Text, Link } = Typography;
const { Panel } = Collapse;

const AdminGuide = () => {
  // Permission descriptions
  const permissionDescriptions: Record<Permission, string> = {
    view: "View and list resources. Read-only access to data.",
    create: "Create new resources. Add new records, items, or content.",
    update: "Edit existing resources. Modify data and settings.",
    delete: "Remove resources. Delete records and content permanently.",
    approve: "Approve pending items. Accept KYC submissions, products, reviews, etc.",
    reject: "Reject pending items. Decline submissions with reasons.",
    assign: "Assign resources to users. Allocate tasks, tickets, or responsibilities.",
    block: "Block or disable resources. Restrict access or deactivate accounts.",
  };

  // Module permissions table data
  const modulePermissionsData = MODULE_NAMES.map((module) => {
    const isViewOnly = module.viewOnly;
    return {
      key: module.key,
      module: module.label,
      viewOnly: isViewOnly ? "Yes" : "No",
      permissions: isViewOnly
        ? ["view"]
        : module.key === "sellerDeactivationRequests"
        ? ["view", "approve", "reject"]
        : ["view", "create", "update", "delete", "approve", "reject", "assign", "block"],
    };
  });

  const permissionColumns = [
    {
      title: "Permission",
      dataIndex: "permission",
      key: "permission",
      render: (permission: Permission) => (
        <Tag color={PERMISSION_COLORS[permission]} style={{ fontWeight: 600 }}>
          {permission.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
  ];

  const permissionTableData = PERMISSIONS.map((perm) => ({
    key: perm,
    permission: perm,
    description: permissionDescriptions[perm],
  }));

  const moduleColumns = [
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "View Only",
      dataIndex: "viewOnly",
      key: "viewOnly",
      render: (value: string) => (
        <Badge
          status={value === "Yes" ? "warning" : "success"}
          text={value}
        />
      ),
    },
    {
      title: "Available Permissions",
      dataIndex: "permissions",
      key: "permissions",
      render: (permissions: string[]) => (
        <Space wrap>
          {permissions.map((perm) => (
            <Tag
              key={perm}
              color={PERMISSION_COLORS[perm as Permission]}
              style={{ fontSize: 11 }}
            >
              {perm}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Header */}
        <Card>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BookOutlined style={{ fontSize: 32, color: "#1890ff" }} />
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  Admin Panel User Guide
                </Title>
                <Text type="secondary">
                  Comprehensive guide to using the Kourier Boyz Admin Panel
                </Text>
              </div>
            </div>
            <Alert
              message="Welcome to the Admin Panel!"
              description="This guide will help you understand how to use all features of the admin panel effectively. Navigate through the sections below to learn more."
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Space>
        </Card>

        {/* Quick Navigation */}
        <Card title="Quick Navigation" size="small">
          <List
            size="small"
            dataSource={[
              { title: "Getting Started", anchor: "getting-started" },
              { title: "Role & Permission System", anchor: "roles-permissions" },
              { title: "Module Overview", anchor: "modules" },
              { title: "Common Workflows", anchor: "workflows" },
              { title: "Best Practices", anchor: "best-practices" },
              { title: "Troubleshooting", anchor: "troubleshooting" },
            ]}
            renderItem={(item) => (
              <List.Item>
                <Link
                  href={`#${item.anchor}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(item.anchor)
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {item.title}
                </Link>
              </List.Item>
            )}
          />
        </Card>

        <Collapse
          defaultActiveKey={["getting-started"]}
          size="large"
          items={[
            {
              key: "getting-started",
              label: (
                <Space>
                  <CheckCircleOutlined />
                  <Text strong>Getting Started</Text>
                </Space>
              ),
              children: (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <Title level={4}>Welcome to Kourier Boyz Admin Panel</Title>
                  <Paragraph>
                    The Kourier Boyz Admin Panel is a comprehensive management system for
                    overseeing all aspects of the marketplace, from user management to
                    order processing, financial settlements, and content moderation.
                  </Paragraph>

                  <Title level={5}>Accessing the Admin Panel</Title>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Login URL">
                      Navigate to the admin panel URL and enter your credentials
                    </Descriptions.Item>
                    <Descriptions.Item label="Super Admin">
                      Super admin accounts have full access to all features
                    </Descriptions.Item>
                    <Descriptions.Item label="Role-Based Access">
                      Other admin users have access based on their assigned roles
                    </Descriptions.Item>
                  </Descriptions>

                  <Title level={5}>Navigation</Title>
                  <Paragraph>
                    The sidebar on the left contains all available modules, organized
                    into logical groups:
                  </Paragraph>
                  <List
                    size="small"
                    dataSource={[
                      "Dashboard - Overview and key metrics",
                      "Order Lifecycle - Orders and Returns management",
                      "User Management - Sellers and Customers",
                      "Finance - Settlements, Invoices, and Credit Notes",
                      "Reports & Compliance - Various analytical reports",
                      "Catalog & Marketing - Products, Categories, Coupons, etc.",
                      "Support & Communication - Tickets, Chats, Articles",
                      "System Settings - Configuration and role management",
                    ]}
                    renderItem={(item) => (
                      <List.Item>
                        <Text>{item}</Text>
                      </List.Item>
                    )}
                  />

                  <Title level={5}>Key Features</Title>
                  <List
                    size="small"
                    dataSource={[
                      "Role-based access control with granular permissions",
                      "Real-time notifications and updates",
                      "Comprehensive reporting and analytics",
                      "Bulk operations for efficiency",
                      "Advanced filtering and search capabilities",
                      "Audit logs for all financial operations",
                    ]}
                    renderItem={(item) => (
                      <List.Item>
                        <CheckCircleOutlined
                          style={{ color: "#52c41a", marginRight: 8 }}
                        />
                        {item}
                      </List.Item>
                    )}
                  />
                </Space>
              ),
            },
            {
              key: "roles-permissions",
              label: (
                <Space>
                  <SafetyOutlined />
                  <Text strong>Role & Permission System</Text>
                </Space>
              ),
              children: (
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <div>
                    <Title level={4}>Understanding Roles and Permissions</Title>
                    <Paragraph>
                      The admin panel uses a role-based access control (RBAC) system
                      to manage what different users can access and do.
                    </Paragraph>
                  </div>

                  <Card title="What are Roles?" size="small">
                    <Paragraph>
                      Roles are collections of permissions that define what actions a
                      user can perform. For example:
                    </Paragraph>
                    <List
                      size="small"
                      dataSource={[
                        "Content Moderator - Can approve/reject products and reviews",
                        "Finance Manager - Can manage settlements and generate reports",
                        "Support Agent - Can handle tickets and customer inquiries",
                        "Super Admin - Has access to everything",
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <Text>{item}</Text>
                        </List.Item>
                      )}
                    />
                  </Card>

                  <Card title="Understanding Permissions" size="small">
                    <Paragraph>
                      Permissions are granular actions that can be assigned to roles.
                      There are 8 types of permissions:
                    </Paragraph>
                    <Table
                      columns={permissionColumns}
                      dataSource={permissionTableData}
                      pagination={false}
                      size="small"
                    />
                  </Card>

                  <Card title="How Permissions Work" size="small">
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <div>
                        <Title level={5}>Permission Checking</Title>
                        <List
                          size="small"
                          dataSource={[
                            "Every action in the admin panel checks if you have the required permission",
                            "If you don't have permission, buttons will be hidden or disabled",
                            "API requests will return 403 (Forbidden) if you lack permissions",
                            "Super admins bypass all permission checks",
                          ]}
                          renderItem={(item) => (
                            <List.Item>
                              <Text>{item}</Text>
                            </List.Item>
                          )}
                        />
                      </div>

                      <div>
                        <Title level={5}>Multiple Roles</Title>
                        <Paragraph>
                          If a user has multiple roles assigned, their permissions are
                          combined (union). If any role grants a permission, the user
                          has it.
                        </Paragraph>
                      </div>

                      <Alert
                        message="Permission Best Practice"
                        description="Always follow the principle of least privilege - only grant permissions that are necessary for a user's job function."
                        type="warning"
                        showIcon
                      />
                    </Space>
                  </Card>

                  <Card title="Creating and Managing Roles" size="small">
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <div>
                        <Title level={5}>Creating a New Role</Title>
                        <List
                          size="small"
                          dataSource={[
                            "Navigate to System Settings → Role Management",
                            "Click 'Create Role' button",
                            "Enter role name and description",
                            "Select permissions for each module",
                            "Click 'Create' to save",
                          ]}
                          renderItem={(item, index) => <List.Item>{index + 1}. {item}</List.Item>}
                        />
                      </div>

                      <div>
                        <Title level={5}>Assigning Roles to Users</Title>
                        <List
                          size="small"
                          dataSource={[
                            "Navigate to System Settings → User Management",
                            "Find the user you want to assign roles to",
                            "Click on the user to view details",
                            "Use 'Assign Roles' option",
                            "Select one or more roles",
                            "Save the assignment",
                          ]}
                          renderItem={(item, index) => <List.Item>{index + 1}. {item}</List.Item>}
                        />
                      </div>

                      <Alert
                        message="System Roles"
                        description="System roles (like Super Admin) cannot be deleted or modified. Only custom roles can be edited."
                        type="info"
                        showIcon
                      />
                    </Space>
                  </Card>
                </Space>
              ),
            },
            {
              key: "modules",
              label: (
                <Space>
                  <LockOutlined />
                  <Text strong>Module Overview & Permissions</Text>
                </Space>
              ),
              children: (
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <div>
                    <Title level={4}>All Available Modules</Title>
                    <Paragraph>
                      The admin panel is organized into modules, each with specific
                      permissions. Below is a comprehensive list of all modules and
                      their available permissions:
                    </Paragraph>
                  </div>

                  <Table
                    columns={moduleColumns}
                    dataSource={modulePermissionsData}
                    pagination={{ pageSize: 10 }}
                    size="small"
                    scroll={{ x: true }}
                  />

                  <Alert
                    message="View-Only Modules"
                    description="Some modules like Dashboard, Audit Logs, and Reports are view-only. They only support the 'view' permission and are used for monitoring and reporting purposes."
                    type="info"
                    showIcon
                  />
                </Space>
              ),
            },
            {
              key: "workflows",
              label: (
                <Space>
                  <BulbOutlined />
                  <Text strong>Common Workflows</Text>
                </Space>
              ),
              children: (
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <Title level={4}>Common Administrative Workflows</Title>

                  <Card title="Seller Onboarding Workflow" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Seller registers on the platform",
                        "Navigate to User Management → Sellers",
                        "Review seller's KYC submission",
                        "Verify all documents are complete",
                        "Approve or reject the seller",
                        "If approved, seller can start listing products",
                      ]}
                      renderItem={(item, index) => <List.Item>{index + 1}. {item}</List.Item>}
                    />
                    <Divider />
                    <Text type="secondary">
                      <strong>Required Permissions:</strong> sellerManagement (view,
                      approve, reject)
                    </Text>
                  </Card>

                  <Card title="Product Approval Workflow" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Navigate to Products page",
                        "Filter by status: 'Pending Approval'",
                        "Review product details, images, and specifications",
                        "Check for required certificates",
                        "Approve, reject, or raise objections",
                        "If rejected, provide clear rejection reason",
                      ]}
                      renderItem={(item, index) => <List.Item>{index + 1}. {item}</List.Item>}
                    />
                    <Divider />
                    <Text type="secondary">
                      <strong>Required Permissions:</strong> products (view, approve,
                      reject)
                    </Text>
                  </Card>

                  <Card title="Order Management Workflow" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Navigate to Orders page",
                        "View order details and status",
                        "Track shipment if needed",
                        "Handle returns/refunds if requested",
                        "Monitor order fulfillment metrics",
                      ]}
                      renderItem={(item, index) => <List.Item>{index + 1}. {item}</List.Item>}
                    />
                    <Divider />
                    <Text type="secondary">
                      <strong>Required Permissions:</strong> orders (view, update)
                    </Text>
                  </Card>

                  <Card title="Settlement Processing Workflow" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Navigate to Finance → Settlement Batches",
                        "Review pending settlement batches",
                        "Generate settlement batches for eligible orders",
                        "Review financial calculations",
                        "Mark batch as paid after payment is processed",
                        "Generate invoices for sellers",
                        "Create credit notes if adjustments are needed",
                      ]}
                      renderItem={(item, index) => <List.Item>{index + 1}. {item}</List.Item>}
                    />
                    <Divider />
                    <Text type="secondary">
                      <strong>Required Permissions:</strong> settlements (view, create,
                      approve), settlementInvoices (view, create), creditNotes (view,
                      create)
                    </Text>
                  </Card>

                  <Card title="Support Ticket Management Workflow" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Navigate to Support & Communication → Support Tickets",
                        "View open tickets and filter by priority/status",
                        "Assign tickets to appropriate team members",
                        "Respond to customer inquiries",
                        "Update ticket status and priority as needed",
                        "Resolve tickets when issues are addressed",
                      ]}
                      renderItem={(item, index) => <List.Item>{index + 1}. {item}</List.Item>}
                    />
                    <Divider />
                    <Text type="secondary">
                      <strong>Required Permissions:</strong> supportTickets (view,
                      update, assign)
                    </Text>
                  </Card>
                </Space>
              ),
            },
            {
              key: "best-practices",
              label: (
                <Space>
                  <BulbOutlined />
                  <Text strong>Best Practices</Text>
                </Space>
              ),
              children: (
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <Title level={4}>Best Practices for Admin Users</Title>

                  <Card title="Security Best Practices" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Never share your admin account credentials",
                        "Use strong, unique passwords",
                        "Enable two-factor authentication if available",
                        "Log out when finished, especially on shared computers",
                        "Review audit logs regularly for suspicious activity",
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <CheckCircleOutlined
                            style={{ color: "#52c41a", marginRight: 8 }}
                          />
                          {item}
                        </List.Item>
                      )}
                    />
                  </Card>

                  <Card title="Role Management Best Practices" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Follow principle of least privilege - grant only necessary permissions",
                        "Create roles based on job functions, not individual users",
                        "Review and update role permissions periodically",
                        "Document role purposes in role descriptions",
                        "Remove unused roles to keep the system clean",
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <CheckCircleOutlined
                            style={{ color: "#52c41a", marginRight: 8 }}
                          />
                          {item}
                        </List.Item>
                      )}
                    />
                  </Card>

                  <Card title="Data Management Best Practices" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Use filters and search to find specific records efficiently",
                        "Verify data before making bulk changes",
                        "Review changes in detail views before saving",
                        "Use audit logs to track all financial operations",
                        "Export important data for backup purposes",
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <CheckCircleOutlined
                            style={{ color: "#52c41a", marginRight: 8 }}
                          />
                          {item}
                        </List.Item>
                      )}
                    />
                  </Card>

                  <Card title="Communication Best Practices" size="small">
                    <List
                      size="small"
                      dataSource={[
                        "Provide clear, actionable feedback when rejecting submissions",
                        "Respond to support tickets promptly",
                        "Use professional language in all communications",
                        "Document important decisions and reasons",
                        "Keep stakeholders informed of major changes",
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <CheckCircleOutlined
                            style={{ color: "#52c41a", marginRight: 8 }}
                          />
                          {item}
                        </List.Item>
                      )}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: "troubleshooting",
              label: (
                <Space>
                  <BulbOutlined />
                  <Text strong>Troubleshooting</Text>
                </Space>
              ),
              children: (
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <Title level={4}>Common Issues and Solutions</Title>

                  <Card title="Permission Issues" size="small">
                    <Collapse size="small" ghost>
                      <Panel
                        header="I can't see certain buttons or features"
                        key="missing-buttons"
                      >
                        <Space direction="vertical" size="small">
                          <Text>
                            This usually means you don't have the required permission.
                          </Text>
                          <List
                            size="small"
                            dataSource={[
                              "Check with your administrator to verify your role permissions",
                              "Navigate to User Management → View your assigned roles",
                              "Contact your supervisor to request additional permissions",
                            ]}
                            renderItem={(item) => (
                              <List.Item>
                                <Text>{item}</Text>
                              </List.Item>
                            )}
                          />
                        </Space>
                      </Panel>

                      <Panel
                        header="I'm getting 403 (Forbidden) errors"
                        key="403-errors"
                      >
                        <Space direction="vertical" size="small">
                          <Text>
                            403 errors occur when you try to perform an action you don't
                            have permission for.
                          </Text>
                          <List
                            size="small"
                            dataSource={[
                              "Verify you have the required permission for the action",
                              "Check if your role permissions were recently changed",
                              "Try refreshing the page and logging in again",
                            ]}
                            renderItem={(item) => (
                              <List.Item>
                                <Text>{item}</Text>
                              </List.Item>
                            )}
                          />
                        </Space>
                      </Panel>
                    </Collapse>
                  </Card>

                  <Card title="Data Issues" size="small">
                    <Collapse size="small" ghost>
                      <Panel header="I can't find a specific record" key="find-record">
                        <Space direction="vertical" size="small">
                          <List
                            size="small"
                            dataSource={[
                              "Use the search/filter functionality",
                              "Check if you have view permission for the module",
                              "Verify you're looking in the correct module",
                              "Try different search terms or filters",
                            ]}
                            renderItem={(item) => (
                              <List.Item>
                                <Text>{item}</Text>
                              </List.Item>
                            )}
                          />
                        </Space>
                      </Panel>

                      <Panel
                        header="Data is not updating after changes"
                        key="data-not-updating"
                      >
                        <Space direction="vertical" size="small">
                          <List
                            size="small"
                            dataSource={[
                              "Refresh the page to see latest data",
                              "Check if you have update permission",
                              "Verify the changes were saved successfully",
                              "Clear browser cache if issue persists",
                            ]}
                            renderItem={(item) => (
                              <List.Item>
                                <Text>{item}</Text>
                              </List.Item>
                            )}
                          />
                        </Space>
                      </Panel>
                    </Collapse>
                  </Card>

                  <Card title="General Issues" size="small">
                    <Collapse size="small" ghost>
                      <Panel header="The page is loading slowly" key="slow-loading">
                        <Space direction="vertical" size="small">
                          <List
                            size="small"
                            dataSource={[
                              "Check your internet connection",
                              "Try using filters to reduce data load",
                              "Clear browser cache and cookies",
                              "Contact IT support if issue persists",
                            ]}
                            renderItem={(item) => (
                              <List.Item>
                                <Text>{item}</Text>
                              </List.Item>
                            )}
                          />
                        </Space>
                      </Panel>

                      <Panel header="I'm logged out unexpectedly" key="logged-out">
                        <Space direction="vertical" size="small">
                          <List
                            size="small"
                            dataSource={[
                              "This may happen after a period of inactivity",
                              "Simply log in again with your credentials",
                              "If this happens frequently, contact IT support",
                              "Check if your session expired",
                            ]}
                            renderItem={(item) => (
                              <List.Item>
                                <Text>{item}</Text>
                              </List.Item>
                            )}
                          />
                        </Space>
                      </Panel>
                    </Collapse>
                  </Card>

                  <Alert
                    message="Need More Help?"
                    description="If you're experiencing issues not covered here, please contact your administrator or IT support team with details about the problem."
                    type="info"
                    showIcon
                  />
                </Space>
              ),
            },
          ]}
        />

        {/* Footer */}
        <Card>
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Text type="secondary" style={{ textAlign: "center", display: "block" }}>
              For additional support, contact your administrator or refer to the
              system documentation.
            </Text>
            <Text
              type="secondary"
              style={{
                textAlign: "center",
                display: "block",
                fontSize: 12,
              }}
            >
              Last updated: {new Date().toLocaleDateString()}
            </Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default AdminGuide;


