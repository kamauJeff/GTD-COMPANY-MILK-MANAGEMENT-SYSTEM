import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useThemeStore } from '../../store/theme.store';
import {
  LayoutDashboard, Users, Route, Milk, Factory, Store,
  CreditCard, Briefcase, BarChart2, LogOut, Sparkles, Droplets,
  Menu, X, Moon, Sun, Wifi, WifiOff, RefreshCw, UserCircle,
  DollarSign, Send, FileText, ChevronDown, TrendingUp, Building2,
  Receipt, BookOpen, Bell, Cog
} from 'lucide-react';
import { AIWidget } from '../AIWidget';
import { ToastContainer } from '../Toast';
import { useQueryClient } from '@tanstack/react-query';

// ── Nav structure with groups ─────────────────────────────────────────────────
type NavItem = {
  to: string;
  icon: any;
  label: string;
  end?: boolean;
  roles: string[];
  badge?: string;   // optional badge eg "NEW"
};

type NavGroup = {
  label: string;
  icon: any;
  roles: string[];   // show group if user has ANY of these roles
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    roles: ['ADMIN','OFFICE','GRADER','SHOPKEEPER','DRIVER'],
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, roles: ['ADMIN','OFFICE','GRADER','SHOPKEEPER','DRIVER'] },
    ],
  },
  {
    label: 'Operations',
    icon: Milk,
    roles: ['ADMIN','OFFICE','GRADER','DRIVER'],
    items: [
      { to: '/collections', icon: Milk,      label: 'Collections',   roles: ['ADMIN','OFFICE','GRADER'] },
      { to: '/factory',     icon: Factory,   label: 'Factory',       roles: ['ADMIN','OFFICE'] },
      { to: '/litres',      icon: Droplets,  label: 'Litres Ledger', roles: ['ADMIN','OFFICE'] },
      { to: '/shops',       icon: Store,     label: 'Shops & Sales', roles: ['ADMIN','OFFICE','SHOPKEEPER','DRIVER'] },
    ],
  },
  {
    label: 'Farmers',
    icon: Users,
    roles: ['ADMIN','OFFICE'],
    items: [
      { to: '/farmers',    icon: Users,     label: 'Farmers',    roles: ['ADMIN','OFFICE'] },
      { to: '/routes',     icon: Route,     label: 'Routes',     roles: ['ADMIN','OFFICE'] },
      { to: '/advances',   icon: DollarSign,label: 'Advances',   roles: ['ADMIN','OFFICE'] },
      { to: '/statements', icon: FileText,  label: 'Statements', roles: ['ADMIN','OFFICE'] },
    ],
  },
  {
    label: 'Finance',
    icon: CreditCard,
    roles: ['ADMIN'],
    items: [
      { to: '/payments',     icon: CreditCard, label: 'Payments',     roles: ['ADMIN'] },
      { to: '/disbursement', icon: Send,        label: 'Disbursement', roles: ['ADMIN'] },
      { to: '/payroll',      icon: Briefcase,   label: 'Staff Payroll',roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Analytics',
    icon: BarChart2,
    roles: ['ADMIN','OFFICE'],
    items: [
      { to: '/reports', icon: BarChart2, label: 'Reports', roles: ['ADMIN','OFFICE'] },
      { to: '/ai',      icon: Sparkles,  label: 'Gutoria AI', roles: ['ADMIN','OFFICE'] },
    ],
  },
  {
    label: 'System',
    icon: Cog,
    roles: ['ADMIN'],
    items: [
      { to: '/settings', icon: Cog, label: 'Settings', roles: ['ADMIN'] },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Collapsed groups state — persist which groups are open
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleLogout = () => { logout(); navigate('/login'); };

  const toggleGroup = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Online/offline detection
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Auto-refresh every 30s when online
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) { qc.invalidateQueries(); setLastRefresh(new Date()); }
    }, 30000);
    return () => clearInterval(interval);
  }, [qc]);

  // Refresh when coming back online
  useEffect(() => {
    const onOnline = () => { qc.invalidateQueries(); setLastRefresh(new Date()); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [qc]);

  const manualRefresh = async () => {
    setRefreshing(true);
    qc.invalidateQueries();
    setLastRefresh(new Date());
    setTimeout(() => setRefreshing(false), 800);
  };

  const userRole = user?.role || 'GRADER';

  // Filter groups and items by role
  const visibleGroups = NAV_GROUPS
    .filter(g => g.roles.includes(userRole))
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(userRole)) }))
    .filter(g => g.items.length > 0);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo + user */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center text-white text-base">🐄</div>
            <div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100">Gutoria Dairies</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">Management System</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 p-1 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        {/* User info card */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="w-7 h-7 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
            <UserCircle size={16} className="text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{user?.name}</div>
            <div className="text-[10px] text-green-600 dark:text-green-400 font-medium">{user?.role}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-1">
        {visibleGroups.map((group) => {
          const isCollapsed = collapsed[group.label];
          const GroupIcon = group.icon;
          const isSingleItem = group.items.length === 1;

          // Single-item groups render directly without a group header
          if (isSingleItem) {
            const item = group.items[0];
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`
                }>
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          }

          return (
            <div key={group.label}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <GroupIcon size={11} />
                  {group.label}
                </div>
                <ChevronDown size={11} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>

              {/* Group items */}
              {!isCollapsed && (
                <div className="space-y-0.5 mb-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink key={item.to} to={item.to} end={item.end}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-sm transition-all ${
                            isActive
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                          }`
                        }>
                        <Icon size={15} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full font-bold">
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

      {/* Bottom bar */}
      <div className="p-2 border-t border-gray-100 dark:border-gray-700 space-y-0.5">
        {/* Online/refresh status */}
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-1.5">
            {isOnline
              ? <Wifi size={11} className="text-green-500" />
              : <WifiOff size={11} className="text-red-400" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span>{lastRefresh.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button onClick={manualRefresh} title="Refresh all data"
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-600 transition-colors">
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <NavLink to="/profile" onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
            }`
          }>
          <UserCircle size={15} />
          My Profile
        </NavLink>

        <button onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all">
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>

        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-white dark:bg-gray-900 shadow-xl flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Menu size={20} />
          </button>
          <div className="text-sm font-bold text-green-600 dark:text-green-400">🐄 Gutoria Dairies</div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <AIWidget />
      <ToastContainer />
    </div>
  );
}
