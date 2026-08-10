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
    <Layout className="min-h-screen">
      <Sidebar />
      <Layout className="bg-gray-50">
        <HeaderBar />
        {/* Let content grow naturally and scroll when needed, instead of locking to viewport height */}
        <Content className="m-6 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-sm p-6 min-h-[calc(100vh-64px-48px)] relative">
            {isLoading ? <LoadingState /> : <Outlet />}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
