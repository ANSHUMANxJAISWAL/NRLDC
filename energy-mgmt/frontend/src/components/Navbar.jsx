import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Brand logo */}
      <div className="flex items-center gap-3 select-none">
        <img src="/logo.png" alt="GRID-INDIA Logo" className="h-8 object-contain" />
        <span className="text-lg font-bold tracking-tight text-slate-800">
          NRLDC Power Management
        </span>
      </div>

      {/* User Information & Action Bar */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-sm font-semibold text-slate-800">{user.username}</span>
          <span className="text-xs text-slate-400 capitalize">{user.email}</span>
        </div>

        {/* Role Badge */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold select-none ${
            user.role === 'admin'
              ? 'bg-rose-50 text-rose-600 border border-rose-100'
              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }`}
        >
          {user.role === 'admin' ? 'Administrator' : 'Operator'}
        </span>

        <div className="h-6 w-px bg-slate-200"></div>

        {/* Logout Action */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-xl transition-all-300"
          title="Sign out of your session"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
