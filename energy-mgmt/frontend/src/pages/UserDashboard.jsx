import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import { plantsAPI, authAPI, poolingStationsAPI } from '../services/api';

const UserDashboard = () => {
  const [activeTab, setActiveTab] = useState('my-plants'); // 'my-plants' or 'profile'
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // States for adding power plants
  const [poolingStations, setPoolingStations] = useState([]);
  const [plantModal, setPlantModal] = useState({ isOpen: false, type: 'add', data: null });
  const [plantConnectionType, setPlantConnectionType] = useState('');
  const [plantRegion, setPlantRegion] = useState('');
  const [plantState, setPlantState] = useState('');

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

  // Load pooling stations for creation
  useEffect(() => {
    const fetchPoolingStations = async () => {
      try {
        const data = await poolingStationsAPI.getAll();
        setPoolingStations(data.poolingStations || []);
      } catch (err) {
        console.error('Error loading pooling stations:', err);
      }
    };
    fetchPoolingStations();
  }, []);

  const handleOpenAddPlant = () => {
    setPlantConnectionType('');
    setPlantRegion('');
    setPlantState('');
    setPlantModal({ isOpen: true, type: 'add', data: null });
  };

  const handleSavePlant = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedStationName = formData.get('pooling_station') || '';
    const matchingStation = poolingStations.find(s => s.name === selectedStationName);
    const pooling_station_id = matchingStation ? matchingStation.id : null;

    const plantData = {
      name: formData.get('name'),
      location: formData.get('location'),
      capacity_mw: parseFloat(formData.get('capacity_mw')),
      commissioned_date: formData.get('commissioned_date') || null,
      owner: formData.get('owner') || null,
      company_group: user.username,
      pooling_station: selectedStationName || null,
      pooling_station_id,
      connection_type: formData.get('connection_type') || null,
      region: formData.get('connection_type') === 'ISTS CONNECTED' ? (formData.get('region') || null) : null,
      state: formData.get('connection_type') === 'INTRA-STATE CONNECTED' ? (formData.get('state') || null) : null,
    };

    setLoading(true);
    try {
      await plantsAPI.create(plantData);
      showToast('Power plant created successfully.', 'success');
      setPlantModal({ isOpen: false, type: 'add', data: null });
      
      // Reload plants
      const data = await plantsAPI.getAll();
      setPlants(data.plants);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save power plant.', 'error');
    } finally {
      setLoading(false);
    }
  };

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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">My Assigned Power Plants</h2>
                  <p className="text-sm text-slate-500 font-medium">Grid systems currently under your operational scope</p>
                </div>
                <button
                  onClick={handleOpenAddPlant}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-all duration-300 shadow-md shadow-teal-50"
                >
                  + Add plant
                </button>
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
                        <div className="grid grid-cols-2 gap-4 py-3 bg-slate-50 rounded-2xl mb-5 text-center border border-slate-100">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Inverters</div>
                            <div className="text-lg font-bold text-slate-800">{p.inverter_count}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Capacity</div>
                            <div className="text-lg font-bold text-teal-700">{Number(p.capacity_mw).toFixed(2)} MW</div>
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

      {/* MODAL: PLANT ADD */}
      {plantModal.isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4 capitalize">
              Add Power Plant
            </h3>
            {poolingStations.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-4xl">⚠️</span>
                <p className="mt-4 text-slate-700 font-bold">
                  No pooling stations are registered in the system.
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-6">
                  An administrator must register a pooling station before you can create a power plant.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlantModal({ isOpen: false, type: 'add', data: null })}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePlant} className="space-y-4 font-sans">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Plant Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Bhadla Solar"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Location / Area</label>
                    <input
                      type="text"
                      name="location"
                      required
                      placeholder="e.g. Jodhpur, Rajasthan"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pooling Station</label>
                    <select
                      name="pooling_station"
                      required
                      defaultValue=""
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="">— Select Pooling Station —</option>
                      {poolingStations.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity (MW)</label>
                    <input
                      type="number"
                      step="0.001"
                      name="capacity_mw"
                      required
                      placeholder="150.00"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Connection Type</label>
                    <select
                      name="connection_type"
                      value={plantConnectionType}
                      onChange={(e) => setPlantConnectionType(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="">— Select Connection —</option>
                      <option value="ISTS CONNECTED">ISTS CONNECTED</option>
                      <option value="INTRA-STATE CONNECTED">INTRA-STATE CONNECTED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Commissioned Date</label>
                    <input
                      type="date"
                      name="commissioned_date"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {plantConnectionType === 'ISTS CONNECTED' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Region</label>
                      <select
                        name="region"
                        value={plantRegion}
                        onChange={(e) => setPlantRegion(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                      >
                        <option value="">— Select Region —</option>
                        <option value="NORTHERN REGION">NORTHERN REGION</option>
                        <option value="WESTERN REGION">WESTERN REGION</option>
                        <option value="SOUTHERN REGION">SOUTHERN REGION</option>
                        <option value="EASTERN REGION">EASTERN REGION</option>
                        <option value="NORTH EASTERN REGION">NORTH EASTERN REGION</option>
                      </select>
                    </div>
                  )}
                  {plantConnectionType === 'INTRA-STATE CONNECTED' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
                      <select
                        name="state"
                        value={plantState}
                        onChange={(e) => setPlantState(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                      >
                        <option value="">— Select State —</option>
                        {[
                          'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
                          'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
                          'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
                          'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 
                          'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Jammu and Kashmir'
                        ].map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Owner / Operator</label>
                    <input
                      type="text"
                      name="owner"
                      placeholder="e.g. Acme Solar"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPlantModal({ isOpen: false, type: 'add', data: null })}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-sm shadow-lg shadow-rose-100"
                  >
                    Create Plant
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
