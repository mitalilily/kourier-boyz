import { Card, Col, Row } from "antd";
import { memo } from "react";
import type { UserStats } from "../../types/userManagement";
import { USER_MANAGEMENT_UI_CONFIG } from "../../config/userManagement";

interface UserStatsCardProps {
  stats: UserStats;
}

export const UserStatsCard = memo(({ stats }: UserStatsCardProps) => {
  const statItems = [
    { label: "Admin Users", value: stats.totalAdmins },
    { label: "Super Admins", value: stats.superAdmins },
    { label: "With Custom Roles", value: stats.withCustomRoles },
    { label: "Available Roles", value: stats.availableRoles },
  ];

  return (
    <Card
      size="small"
      style={{
        background: USER_MANAGEMENT_UI_CONFIG.statsCard.gradient,
        border: "none",
        color: "white",
        marginTop: 16,
      }}
    >
      <Row gutter={16}>
        {statItems.map((item) => (
          <Col key={item.label} span={6}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: "bold",
                  marginBottom: 4,
                }}
              >
                {item.value}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>{item.label}</div>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
});

UserStatsCard.displayName = "UserStatsCard";
