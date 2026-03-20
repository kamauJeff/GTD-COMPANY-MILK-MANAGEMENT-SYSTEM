import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useThemeStore } from '../../store/theme.store';
import {
  LayoutDashboard, Users, Route, Milk, Factory, Store,
  CreditCard, Briefcase, BarChart2, LogOut, Sparkles, Droplets,
  Menu, X, Moon, Sun, Wifi, WifiOff, RefreshCw, UserCircle, DollarSign
} from 'lucide-react';
import { AIWidget } from '../AIWidget';
import { ToastContainer } from '../Toast';
import { useQueryClient } from '@tanstack/react-query';

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard',       end: true,  roles: ['ADMIN','OFFICE','GRADER','SHOPKEEPER','DRIVER'] },
  { to: '/farmers',     icon: Users,           label: 'Farmers',                     roles: ['ADMIN','OFFICE'] },
  { to: '/routes',      icon: Route,           label: 'Routes',                      roles: ['ADMIN','OFFICE'] },
  { to: '/collections', icon: Milk,            label: 'Collections',                 roles: ['ADMIN','OFFICE','GRADER'] },
  { to: '/factory',     icon: Factory,         label: 'Factory',                     roles: ['ADMIN','OFFICE'] },
  { to: '/litres',      icon: Droplets,        label: 'Litres Ledger',               roles: ['ADMIN','OFFICE'] },
  { to: '/advances',    icon: DollarSign,      label: 'Advances',                    roles: ['ADMIN','OFFICE'] },
  { to: '/shops',       icon: Store,           label: 'Shops & Sales',               roles: ['ADMIN','OFFICE','SHOPKEEPER','DRIVER'] },
  { to: '/payments',    icon: CreditCard,      label: 'Farmer Payments',             roles: ['ADMIN'] },
  { to: '/payroll',     icon: Briefcase,       label: 'Staff Payroll',               roles: ['ADMIN'] },
  { to: '/reports',     icon: BarChart2,       label: 'Reports',                     roles: ['ADMIN','OFFICE'] },
  { to: '/ai',          icon: Sparkles,        label: 'Gutoria AI',                  roles: ['ADMIN','OFFICE'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const handleLogout = () => { logout(); navigate('/login'); };

  // Online/offline detection
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      qc.invalidateQueries();
      setLastRefresh(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, [qc]);

  const manualRefresh = () => {
    qc.invalidateQueries();
    setLastRefresh(new Date());
  };

  const userRole = user?.role || 'GRADER';
  const visibleNav = NAV.filter(n => n.roles.includes(userRole));

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <div className="text-base font-bold text-green-600 dark:text-green-400">🐄 Gutoria Dairies</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[150px]">{user?.name}</div>
          <div className="text-xs font-medium text-green-600 dark:text-green-500">{user?.role}</div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 p-1">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`
            }>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <NavLink to="/profile" onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
              isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
            }`
          }>
          <UserCircle size={16} />
          My Profile
        </NavLink>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-60
        bg-white dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-700
        flex flex-col shadow-xl md:shadow-none
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-3 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-600 dark:text-gray-300 p-1">
            <Menu size={22} />
          </button>
          <div className="hidden md:block text-sm font-bold text-green-700 dark:text-green-400">🐄 Gutoria Dairies</div>
          <div className="flex-1" />

          {/* Online indicator */}
          <div className={`hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${isOnline ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600'}`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? 'Live' : 'Offline'}
          </div>

          {/* Last refresh */}
          <button onClick={manualRefresh}
            className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            title="Refresh all data">
            <RefreshCw size={12} />
            <span>{lastRefresh.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
          </button>

          {/* Dark mode toggle */}
          <button onClick={toggle}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer />

      {/* AI Widget */}
      <AIWidget />
    </div>
  );
}
