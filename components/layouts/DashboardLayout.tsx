'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Building2,
  Users,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  Clock,
  Gauge,
  FileText,
  Key,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: 'Sites',
    href: '/sites',
    icon: <Building2 className="w-5 h-5" />,
    children: [
      {
        label: 'All Sites',
        href: '/sites',
        icon: <Building2 className="w-4 h-4" />,
      },
      {
        label: 'Control',
        href: '/dashboard/control',
        icon: <Gauge className="w-4 h-4" />,
        roles: ['admin', 'technician'],
      },
      {
        label: 'Schedules',
        href: '/schedules',
        icon: <Clock className="w-4 h-4" />,
        roles: ['admin', 'technician'],
      },
    ],
  },
  {
    label: 'Customers',
    href: '/dashboard/customers',
    icon: <Users className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    label: 'Meters',
    href: '/dashboard/meters',
    icon: <Activity className="w-5 h-5" />,
    roles: ['admin', 'technician'],
  },
  {
    label: 'Admin',
    href: '/admin',
    icon: <Shield className="w-5 h-5" />,
    roles: ['admin'],
    children: [
      {
        label: 'Users',
        href: '/admin/users',
        icon: <Users className="w-4 h-4" />,
      },
      {
        label: 'Audit Log',
        href: '/admin/audit',
        icon: <FileText className="w-4 h-4" />,
      },
      {
        label: 'API Keys',
        href: '/admin/api-keys',
        icon: <Key className="w-4 h-4" />,
      },
    ],
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || '');
  }).map(item => ({
    ...item,
    children: item.children?.filter(child => {
      if (!child.roles) return true;
      return child.roles.includes(user?.role || '');
    })
  }));

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <h1 className="text-xl font-bold text-gray-900">Meterum</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* User info */}
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="text-sm text-gray-600">Logged in as</div>
            <div className="font-medium text-gray-900">{user.username}</div>
            <div className="text-xs text-gray-500 capitalize">{user.role}</div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <div key={item.label}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.label)}
                      className={`w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md hover:bg-gray-100 ${
                        pathname.startsWith(item.href)
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center">
                        {item.icon}
                        <span className="ml-3">{item.label}</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          expandedItems.includes(item.label) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {expandedItems.includes(item.label) && (
                      <div className="space-y-1 pl-8">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                              pathname === child.href
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            {child.icon}
                            <span className="ml-3">{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      pathname === item.href
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.icon}
                    <span className="ml-3">{item.label}</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="border-t p-4">
            <Link
              href="/settings"
              className="group flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900"
            >
              <Settings className="w-5 h-5" />
              <span className="ml-3">Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full group flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900"
            >
              <LogOut className="w-5 h-5" />
              <span className="ml-3">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 bg-white border-b lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex flex-1 items-center justify-between px-4">
            <h1 className="text-xl font-bold text-gray-900">Meterum</h1>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}