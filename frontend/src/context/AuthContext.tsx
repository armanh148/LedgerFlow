import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserRole } from '../types';
import { setRoleHeader } from '../api/client';

interface AuthContextType {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  toast: { message: string; type: 'success' | 'error' | 'warning' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  showHotkeysModal: boolean;
  setShowHotkeysModal: (show: boolean) => void;

  // Sidebar toggle
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Role Permission Helper Flags
  canPostGL: boolean;
  canRecordPayments: boolean;
  canReconcileBank: boolean;
  canManagePeriodLock: boolean;
  canCreateDrafts: boolean;
  isReadOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('ledgerflow_role') as UserRole) || 'ACCOUNTANT';
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showHotkeysModal, setShowHotkeysModal] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  useEffect(() => {
    setRoleHeader(activeRole);
  }, [activeRole]);

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
    localStorage.setItem('ledgerflow_role', role);
    setRoleHeader(role);
    showToast(`Switched role to ${role}`, 'success');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Role Permissions Logic
  const canPostGL = activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT';
  const canRecordPayments = activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT';
  const canReconcileBank = activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT';
  const canManagePeriodLock = activeRole === 'ADMIN';
  const canCreateDrafts = activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT' || activeRole === 'DATA_ENTRY';
  const isReadOnly = activeRole === 'AUDITOR';

  return (
    <AuthContext.Provider value={{
      activeRole,
      setActiveRole,
      activeTab,
      setActiveTab,
      toast,
      showToast,
      showHotkeysModal,
      setShowHotkeysModal,
      sidebarOpen,
      toggleSidebar,
      canPostGL,
      canRecordPayments,
      canReconcileBank,
      canManagePeriodLock,
      canCreateDrafts,
      isReadOnly
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
