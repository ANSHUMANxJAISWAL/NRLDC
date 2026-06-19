import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import { plantsAPI, authAPI } from '../services/api';

const UserDashboard = () => {
  const [activeTab, setActiveTab] = useState('my-plants'); // 'my-plants' or 'profile'
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Load plants scoped to this user
  useEffect(() => {
    const fetchUserPlants = async () => {
      setLoading(true);
      try {
        const data = await plantsAPI.getAll();
        setPlants(data.plants);
      } catch (err) {
        console.error(err);
        showToast('Error loading power plants.', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'my-plants') {
      fetchUserPlants();
    }
  }, [activeTab, showToast]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      showToast('Please fill in all password fields.', 'warning');
      return;
    }

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    setPwdSubmitting(true);
    try {
      await authAPI.changePassword(pwdForm.currentPassword, pwdForm.newPassword);
      showToast('Password updated successfully.', 'success');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update password.', 'error');
    } finally {
      setPwdSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Sidebar */}
        <aside className="w-full md:w-64 bg-teal-950 text-slate-200 flex-shrink-0 flex flex-col justify-between border-r border-teal-900 select-none">
          <div className="p-4">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-teal-400">
              Operator Portal
            </div>
            <nav className="mt-4 space-y-1">
              <button
                onClick={() => setActiveTab('my-plants')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 ${
                  activeTab === 'my-plants'
                    ? 'bg-teal-500/10 text-teal-300 font-bold border border-teal-500/20'
                    : 'hover:bg-teal-900/60 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                My Plants
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 ${
                  activeTab === 'profile'
                    ? 'bg-teal-500/10 text-teal-300 font-bold border border-teal-500/20'
                    : 'hover:bg-teal-900/60 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                My Profile
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {loading && (
            <div className="mb-4 text-sm font-semibold text-teal-600 bg-teal-50 border border-teal-100 p-3 rounded-xl flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Connecting to power grids...</span>
            </div>
          )}

          {/* TAB: MY PLANTS (CARD GRID) */}
          {activeTab === 'my-plants' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">My Assigned Power Plants</h2>
                <p className="text-sm text-slate-500 font-medium">Grid systems currently under your operational scope</p>
              </div>

              {plants.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
                  <span className="text-4xl">📭</span>
                  <h3 className="text-lg font-bold text-slate-800 mt-4">No Plants Assigned</h3>
                  <p className="text-sm text-slate-400 mt-1">You do not have any power plants assigned to your account. Please contact an administrator.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {plants.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md hover:border-teal-100 p-6 flex flex-col justify-between transition-all duration-300 group"
                    >
                      <div>
                        {/* Title & Write status */}
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="text-lg font-bold text-slate-800 group-hover:text-teal-600 transition-colors">
                            {p.name}
                          </h3>
                          {!p.can_write ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-400 border border-slate-150 flex-shrink-0">
                              Read Only
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-600 border border-teal-100 flex-shrink-0">
                              Read & Write
                            </span>
                          )}
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold mb-4">
                          <svg className="w-4 h-4 text-slate-350" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{p.location}</span>
                        </div>

                        {/* Inverter summary counts */}
                        <div className="grid grid-cols-3 gap-2 py-3 bg-slate-50 rounded-2xl mb-5 text-center border border-slate-100">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</div>
                            <div className="text-lg font-bold text-slate-800">{p.inverter_count}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Online</div>
                            <div className="text-lg font-bold text-emerald-600">{p.online_count}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Fault</div>
                            <div className="text-lg font-bold text-rose-600">{p.fault_count}</div>
                          </div>
                        </div>
                      </div>

                      {/* View Action */}
                      <button
                        onClick={() => navigate(`/dashboard/plant/${p.id}`)}
                        className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-all-300 flex items-center justify-center gap-1.5 shadow-lg shadow-teal-50"
                      >
                        <span>View Inverters</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MY PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-4xl animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Operator Profile</h2>
                <p className="text-sm text-slate-500 font-medium">Verify credentials and manage your account settings</p>
              </div>

              {/* Profile Details Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Account details */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">Profile Details</h3>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Username</span>
                    <span className="text-sm font-bold text-slate-800">{user.username}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email Address</span>
                    <span className="text-sm font-bold text-slate-800">{user.email}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Operator Role</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 border border-emerald-100 text-emerald-600 bg-emerald-50 rounded-full capitalize">
                      {user.role}
                    </span>
                  </div>
                </div>

                {/* Change Password */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100 mb-4">Change Account Password</h3>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Current Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={pwdForm.currentPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500 transition-all-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={pwdForm.newPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500 transition-all-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={pwdForm.confirmPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500 transition-all-300"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={pwdSubmitting}
                      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-all-300 shadow-md shadow-teal-50 flex items-center justify-center disabled:opacity-50"
                    >
                      {pwdSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        'Save Password'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
