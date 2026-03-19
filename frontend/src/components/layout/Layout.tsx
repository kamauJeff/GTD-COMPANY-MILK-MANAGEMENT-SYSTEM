import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  LayoutDashboard, Users, Route, Milk, Factory, Store,
  CreditCard, Briefcase, BarChart2, LogOut, Sparkles, Droplets, Menu, X
} from 'lucide-react';
import { AIWidget } from '../AIWidget';

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard',       end: true },
  { to: '/farmers',     icon: Users,           label: 'Farmers' },
  { to: '/routes',      icon: Route,           label: 'Routes' },
  { to: '/collections', icon: Milk,            label: 'Collections' },
  { to: '/factory',     icon: Factory,         label: 'Factory' },
  { to: '/litres',      icon: Droplets,        label: 'Litres Ledger' },
  { to: '/shops',       icon: Store,           label: 'Shops' },
  { to: '/payments',    icon: CreditCard,      label: 'Farmer Payments' },
  { to: '/payroll',     icon: Briefcase,       label: 'Staff Payroll' },
  { to: '/reports',     icon: BarChart2,       label: 'Reports' },
  { to: '/ai',          icon: Sparkles,        label: 'Gutoria AI' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <div className="text-base font-bold text-green-700">🐄 Gutoria Dairies</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">{user?.name} · {user?.role}</div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600 p-1">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`
            }>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t">
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden on mobile, shown as drawer */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-60 bg-white border-r flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 p-1">
            <Menu size={22} />
          </button>
          <div className="text-sm font-bold text-green-700">🐄 Gutoria Dairies</div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <AIWidget />
    </div>
  );
}
