import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useThemeStore } from '../../store/theme.store';
import {
  LayoutDashboard, Users, Route, Milk, Factory, Store,
  CreditCard, Briefcase, BarChart2, LogOut, Sparkles, Droplets,
  Menu, X, Moon, Sun, Wifi, WifiOff, RefreshCw, UserCircle,
  DollarSign, Send, FileText, ChevronDown, TrendingUp,
  Bell, Cog
} from 'lucide-react';
import { AIWidget } from '../AIWidget';
import { ToastContainer } from '../Toast';
import { useQueryClient } from '@tanstack/react-query';

type NavItem  = { to: string; icon: any; label: string; end?: boolean; roles: string[]; badge?: string; };
type NavGroup = { label: string; icon: any; roles: string[]; items: NavItem[]; };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview', icon: LayoutDashboard,
    roles: ['ADMIN','OFFICE','GRADER','SHOPKEEPER','DRIVER'],
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, roles: ['ADMIN','OFFICE','GRADER','SHOPKEEPER','DRIVER'] },
    ],
  },
  {
    label: 'Operations', icon: Milk,
    roles: ['ADMIN','OFFICE','GRADER','DRIVER','SHOPKEEPER'],
    items: [
      { to: '/collections', icon: Milk,      label: 'Collections',    roles: ['ADMIN','OFFICE','GRADER'] },
      { to: '/factory',     icon: Factory,   label: 'Factory',        roles: ['ADMIN','OFFICE'] },
      { to: '/litres',      icon: Droplets,  label: 'Litres Ledger',  roles: ['ADMIN','OFFICE'] },
      { to: '/shops',       icon: Store,     label: 'Shops & Sales',  roles: ['ADMIN','OFFICE','SHOPKEEPER','DRIVER'] },
    ],
  },
  {
    label: 'Farmers', icon: Users,
    roles: ['ADMIN','OFFICE'],
    items: [
      { to: '/farmers',    icon: Users,      label: 'Farmers',    roles: ['ADMIN','OFFICE'] },
      { to: '/routes',     icon: Route,      label: 'Routes',     roles: ['ADMIN','OFFICE'] },
      { to: '/advances',   icon: DollarSign, label: 'Advances',   roles: ['ADMIN','OFFICE'] },
      { to: '/statements', icon: FileText,   label: 'Statements', roles: ['ADMIN','OFFICE'] },
    ],
  },
  {
    label: 'Finance', icon: CreditCard,
    roles: ['ADMIN'],
    items: [
      { to: '/payments',     icon: CreditCard, label: 'Payments',     roles: ['ADMIN'] },
      { to: '/disbursement', icon: Send,        label: 'Disbursement', roles: ['ADMIN'] },
      { to: '/payroll',      icon: Briefcase,   label: 'Staff Payroll',roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Analytics', icon: BarChart2,
    roles: ['ADMIN','OFFICE'],
    items: [
      { to: '/reports', icon: BarChart2, label: 'Reports',    roles: ['ADMIN','OFFICE'] },
      { to: '/ai',      icon: Sparkles,  label: 'Gutoria AI', roles: ['ADMIN','OFFICE'] },
    ],
  },
  {
    label: 'System', icon: Cog,
    roles: ['ADMIN'],
    items: [
      { to: '/settings', icon: Cog, label: 'Settings', roles: ['ADMIN'] },
    ],
  },
];

// Page title map for top bar
const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard', '/farmers': 'Farmers', '/routes': 'Routes',
  '/collections': 'Collections', '/factory': 'Factory', '/litres': 'Litres Ledger',
  '/advances': 'Advances', '/statements': 'Statements', '/disbursement': 'Disbursement',
  '/shops': 'Shops & Sales', '/payments': 'Farmer Payments', '/payroll': 'Staff Payroll',
  '/reports': 'Reports', '/ai': 'Gutoria AI', '/settings': 'Settings', '/profile': 'My Profile',
};

export default function Layout() {
  const { user, dairy, logout } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [time, setTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleGroup = (label: string) => setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));

  // Clock — updates every minute
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(() => { if (navigator.onLine) qc.invalidateQueries(); }, 30000);
    return () => clearInterval(iv);
  }, [qc]);

  // Refresh on reconnect
  useEffect(() => {
    const fn = () => qc.invalidateQueries();
    window.addEventListener('online', fn);
    return () => window.removeEventListener('online', fn);
  }, [qc]);

  const manualRefresh = async () => {
    setRefreshing(true);
    qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  const userRole = user?.role || 'GRADER';
  const pageTitle = PAGE_TITLES[location.pathname] || 'Gutoria Dairies';

  const visibleGroups = NAV_GROUPS
    .filter(g => g.roles.includes(userRole))
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(userRole)) }))
    .filter(g => g.items.length > 0);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-950 dark:bg-gray-950">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-green-500/20">
              🐄
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">{dairy?.name || 'Dairy System'}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Management System</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-500 hover:text-gray-300 p-1">
            <X size={16} />
          </button>
        </div>

        {/* User pill */}
        <div className="flex items-center gap-2.5 mt-4 px-3 py-2.5 bg-gray-900 rounded-xl border border-gray-800">
          <div className="w-7 h-7 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
            <UserCircle size={15} className="text-green-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-200 truncate">{user?.name}</div>
            <div className="text-[10px] text-green-400 font-medium">{user?.role}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5 scrollbar-thin">
        {visibleGroups.map((group) => {
          const isCollapsed = collapsed[group.label];
          const GroupIcon = group.icon;
          const isSingle = group.items.length === 1;

          if (isSingle) {
            const item = group.items[0];
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-green-500/15 text-green-400 shadow-sm'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`
                }>
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          }

          return (
            <div key={group.label} className="mb-1">
              <button onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-widest hover:text-gray-400 transition-colors">
                <div className="flex items-center gap-1.5">
                  <GroupIcon size={10} />
                  {group.label}
                </div>
                <ChevronDown size={10} className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink key={item.to} to={item.to} end={item.end}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 pl-5 pr-3 py-2 rounded-xl text-sm transition-all ${
                            isActive
                              ? 'bg-green-500/15 text-green-400 font-semibold'
                              : 'text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'
                          }`
                        }>
                        <Icon size={14} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-full font-bold">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-3 pt-2 border-t border-gray-800 space-y-0.5">
        <NavLink to="/profile" onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
              isActive ? 'bg-blue-500/15 text-blue-400 font-semibold' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`
          }>
          <UserCircle size={14} />
          My Profile
        </NavLink>

        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* Desktop sidebar — always dark */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-gray-950 border-r border-gray-800">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3
          bg-white dark:bg-gray-900
          border-b border-gray-200 dark:border-gray-800
          shadow-sm">

          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Menu size={18} />
            </button>

            {/* Page title */}
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{pageTitle}</h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 hidden md:block">
                {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Right — status + controls */}
          <div className="flex items-center gap-2">

            {/* Online/time pill */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              {isOnline
                ? <Wifi size={11} />
                : <WifiOff size={11} />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="font-mono">{time.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            {/* Refresh */}
            <button onClick={manualRefresh} title="Refresh all data"
              className="p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-green-500' : ''} />
            </button>

            {/* Dark mode toggle */}
            <button onClick={toggle}
              className="p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          <Outlet />
        </main>
      </div>

      <AIWidget />
      <ToastContainer />
    </div>
  );
}
