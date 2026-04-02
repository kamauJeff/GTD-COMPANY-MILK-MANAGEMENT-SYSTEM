import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FarmersPage from './pages/FarmersPage';
import RoutesPage from './pages/RoutesPage';
import CollectionsPage from './pages/CollectionsPage';
import FactoryPage from './pages/FactoryPage';
import ShopsPage from './pages/ShopsPage';
import PaymentsPage from './pages/PaymentsPage';
import PayrollPage from './pages/PayrollPage';
import ReportsPage from './pages/ReportsPage';
import AIPage from './pages/AIPage';
import LitresPage from './pages/LitresPage';
import ProfilePage from './pages/ProfilePage';
import AdvancesPage from './pages/AdvancesPage';
import DisbursementPage from './pages/DisbursementPage';
import StatementPage from './pages/StatementPage';
import SettingsPage from './pages/SettingsPage';
import SuperAdminPage from './pages/SuperAdminPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="farmers"     element={<FarmersPage />} />
        <Route path="routes"      element={<RoutesPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="factory"     element={<FactoryPage />} />
        <Route path="litres"      element={<LitresPage />} />
        <Route path="shops"       element={<ShopsPage />} />
        <Route path="payments"    element={<PaymentsPage />} />
        <Route path="payroll"     element={<PayrollPage />} />
        <Route path="reports"     element={<ReportsPage />} />
        <Route path="ai"          element={<AIPage />} />
        <Route path="profile"     element={<ProfilePage />} />
        <Route path="advances"    element={<AdvancesPage />} />
        <Route path="disbursement" element={<DisbursementPage />} />
        <Route path="statements"   element={<StatementPage />} />
        <Route path="settings"     element={<SettingsPage />} />
        <Route path="super-admin"  element={<SuperAdminPage />} />
      </Route>
    </Routes>
  );
}
