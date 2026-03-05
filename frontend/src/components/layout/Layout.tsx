// src/components/layout/Layout.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  LayoutDashboard, Users, Route, Milk, Factory, Store,
  CreditCard, Briefcase, BarChart2, LogOut
} from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/farmers', icon: Users, label: 'Farmers' },
  { to: '/routes', icon: Route, label: 'Routes' },
  { to: '/collections', icon: Milk, label: 'Collections' },
  { to: '/factory', icon: Factory, label: 'Factory' },
  { to: '/shops', icon: Store, label: 'Shops' },
  { to: '/payments', icon: CreditCard, label: 'Farmer Payments' },
  { to: '/payroll', icon: Briefcase, label: 'Staff Payroll' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r flex flex-col">
        <div className="p-5 border-b">
          <div className="text-lg font-bold text-green-700">ðŸ„ Gutoria Dairies</div>
          <div className="text-xs text-gray-500 mt-0.5">{user?.name} Â· {user?.role}</div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

