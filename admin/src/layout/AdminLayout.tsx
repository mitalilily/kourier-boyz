import { useEffect } from "react";
import { Layout } from "antd";
import { Outlet } from "react-router-dom";
import { usePermissions } from "../api/permissions";
import { useAuthStore } from "../store/authStore";
import LoadingState from "../components/LoadingState";
import HeaderBar from "./HeaderBar";
import Sidebar from "./Sidebar";

const { Content } = Layout;

const AdminLayout = () => {
  const { data: permissions, isLoading } = usePermissions();
  const setPermissions = useAuthStore((state) => state.setPermissions);

  // Store permissions in auth store when fetched
  useEffect(() => {
    if (permissions) {
      setPermissions(permissions);
    }
  }, [permissions, setPermissions]);

  return (
    <Layout className="kb-admin-shell min-h-screen">
      <Sidebar />
      <Layout className="kb-admin-main">
        <HeaderBar />
        <Content className="kb-admin-content overflow-y-auto">
          <div className="kb-admin-page min-h-[calc(100vh-92px)] relative">
            {isLoading ? <LoadingState /> : <Outlet />}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
