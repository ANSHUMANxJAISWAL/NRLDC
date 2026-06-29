import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — guards routes based on auth state and role.
 *
 * Props:
 *   adminOnly       — only 'admin' role allowed
 *   allowedRoles    — array of roles that are allowed (overrides above flags)
 */
const ProtectedRoute = ({ children, adminOnly = false, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Show a clean loading state while fetching profile on mount
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Securing connection...</p>
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role;

  // Explicit allowedRoles check
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
      // Redirect to appropriate dashboard
      if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  }

  // Admin-only check
  if (adminOnly && role !== 'admin') {
    console.warn(`User ${user?.username} (role: ${role}) attempted to access admin-only area.`);
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
