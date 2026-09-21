import React, { createContext, useContext, useState } from 'react';
import type { UserRole } from '../types';
import { setRoleHeader } from '../api/client';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  canPostGL: boolean;
  canManagePeriodLock: boolean;
  isReadOnly: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>('ACCOUNTANT');

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    setRoleHeader(newRole);
  };

  const canPostGL = role === 'ADMIN' || role === 'ACCOUNTANT';
  const canManagePeriodLock = role === 'ADMIN';
  const isReadOnly = role === 'AUDITOR';

  return (
    <RoleContext.Provider value={{ role, setRole, canPostGL, canManagePeriodLock, isReadOnly }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
