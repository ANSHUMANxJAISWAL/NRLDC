import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import { poolingStationsAPI, ppcPlantsAPI } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';

// ─── Helpers ────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    maintenance: 'bg-amber-50 text-amber-700 border-amber-100',
    inactive: 'bg-slate-50 text-slate-500 border-slate-100',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${styles[status] || styles.inactive}`}>
      {status || 'unknown'}
    </span>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-start py-2.5 border-b border-slate-50 last:border-0">
    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-1/2 flex-shrink-0">{label}</span>
    <span className="text-sm font-semibold text-slate-700 text-right">{value || '—'}</span>
  </div>
);

// ─── CSV Export Helper ────────────────────────────────────────────────────────
const exportToCSV = (plants, stationName) => {
  const headers = [
    'Plant Name', 'WBES', 'Capacity MW', 'Owner', 'Evacuating Line', 'POI',
    'PPC OEM', 'Mode of Control', 'Ref Voltage (kV)', 'Deadband %', 'Droop %',
    'Max Q Inj (MVAr)', 'Max Q Abs (MVAr)', 'Comm Time (ms)', 'Sampling Time (ms)',
    'Exec Time (ms)', 'Freq Mode', 'Freq Deadband', 'Freq Droop %',
    'Power Reduction @50.3Hz', 'Status'
  ];

  const rows = plants.map(p => [
    p.plant_name, p.wbes_acronym, p.capacity_mw, p.owner, p.evacuating_line, p.poi,
    p.ppc_oem, p.ppc_mode_of_control, p.ppc_reference_voltage_kv,
    p.ppc_voltage_deadband_pct, p.ppc_voltage_droop_pct,
    p.max_reactive_power_injection_mvar, p.max_reactive_power_absorption_mvar,
    p.ppc_comm_time_ms, p.ppc_sampling_time_ms, p.ppc_total_exec_time_ms,
    p.freq_control_mode, p.freq_deadband, p.freq_droop_pct,
    p.power_reduction_at_50_3hz, p.status
  ].map(v => `"${v ?? ''}"`));

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${stationName.replace(/\s/g, '_')}_ppc_data.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ─── Main Component ──────────────────────────────────────────────────────────
const StationDashboard = () => {
  const { stationId: paramStationId } = useParams();
  const { user, poolingStationId, stationName: ctxStationName, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [station, setStation] = useState(null);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPlant, setSelectedPlant] = useState(null);

  // Which station ID to use: URL param (admin preview) or JWT
  const effectiveStationId = paramStationId || poolingStationId || user?.pooling_station_id;

  const fetchStationData = useCallback(async () => {
    if (!effectiveStationId) return;
    setLoading(true);
    try {
      const data = await poolingStationsAPI.getById(effectiveStationId);
      setStation(data.station);
      setPlants(data.plants);
    } catch (err) {
      console.error(err);
      showToast('Error loading station data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [effectiveStationId, showToast]);

  useEffect(() => {
    fetchStationData();
  }, [fetchStationData]);

  // Derived stats
  const totalCapacity = plants.reduce((acc, p) => acc + parseFloat(p.capacity_mw || 0), 0);
  const withPpcData = plants.filter(p => p.ppc_oem).length;
  const pendingData = plants.length - withPpcData;

  // Chart data
  const chartData = plants.map(p => ({
    name: p.wbes_acronym || p.plant_name.substring(0, 12),
    capacity: parseFloat(p.capacity_mw || 0),
    status: p.status,
  })).sort((a, b) => b.capacity - a.capacity);

  const barColor = (status) => {
    if (status === 'active') return '#10b981';
    if (status === 'maintenance') return '#f59e0b';
    return '#94a3b8';
  };

  // Filtered plants for table
  const filteredPlants = plants.filter(p => {
    const q = search.toLowerCase();
    return !q || p.plant_name?.toLowerCase().includes(q) || p.owner?.toLowerCase().includes(q) || p.wbes_acronym?.toLowerCase().includes(q);
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayStationName = station?.name || ctxStationName || 'Loading...';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-teal-950 text-slate-200 flex-shrink-0 flex flex-col justify-between border-r border-teal-900 select-none">
          <div className="p-4">
            {/* Station branding */}
            <div className="px-3 py-3 mb-2 bg-teal-900/60 rounded-xl border border-teal-800">
              <div className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-1">Pooling Station</div>
              <div className="text-sm font-bold text-white leading-snug">{displayStationName}</div>
            </div>

            <nav className="mt-4 space-y-1">
              {[
                { key: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z' },
                { key: 'ppc-plants', label: 'PPC Plants', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
                { key: 'profile', label: 'Station Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                    activeTab === key
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                      : 'hover:bg-teal-900/60 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
                  </svg>
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Logout */}
          <div className="p-4 border-t border-teal-900">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-900/60 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-semibold transition-all duration-200 border border-teal-800 hover:border-rose-500/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {loading && (
            <div className="mb-4 text-sm font-semibold text-teal-600 bg-teal-50 border border-teal-100 p-3 rounded-xl flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading station data...</span>
            </div>
          )}

          {/* ═══════════════════ TAB: OVERVIEW ═══════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{displayStationName}</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Pooling Station Dashboard — PPC Data Overview</p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total PPC Plants', value: plants.length, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-100' },
                  { label: 'Total Capacity', value: `${totalCapacity.toFixed(2)} MW`, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                  { label: 'With PPC Data', value: withPpcData, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
                  { label: 'Pending Data', value: pendingData, color: pendingData > 0 ? 'text-amber-700' : 'text-slate-400', bg: pendingData > 0 ? 'bg-amber-50' : 'bg-slate-50', border: pendingData > 0 ? 'border-amber-100' : 'border-slate-100' },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} className={`${bg} border ${border} rounded-2xl p-5 shadow-sm`}>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</div>
                    <div className={`text-2xl font-extrabold ${color} mt-2`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Recharts Bar Chart */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-1">Plant Capacity Distribution (MW)</h3>
                <p className="text-xs text-slate-400 font-medium mb-5">Color: 🟢 Active · 🟡 Maintenance · ⚪ Other</p>
                {chartData.length === 0 ? (
                  <div className="text-sm text-slate-400 py-10 text-center">No plant data available.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} unit=" MW" />
                      <Tooltip
                        formatter={(val) => [`${val} MW`, 'Capacity']}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      />
                      <Bar dataKey="capacity" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={barColor(entry.status)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="flex gap-4 items-center justify-center mt-2 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500"></span>Active</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400"></span>Maintenance</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-400"></span>Other</span>
                </div>
              </div>

              {/* Quick summary table */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-hidden">
                <h3 className="text-base font-bold text-slate-800 mb-4">Plants at a Glance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-400 font-bold uppercase">
                        <th className="pb-3">Plant Name</th>
                        <th className="pb-3">Evacuating Line</th>
                        <th className="pb-3">MW</th>
                        <th className="pb-3">Owner</th>
                        <th className="pb-3">PPC OEM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {plants.map(p => (
                        <tr key={p.id} className="hover:bg-teal-50/30 transition-colors cursor-pointer" onClick={() => { setSelectedPlant(p); setActiveTab('ppc-plants'); }}>
                          <td className="py-3 font-semibold text-slate-800 max-w-[200px] truncate">{p.plant_name}</td>
                          <td className="py-3 text-slate-500 font-medium text-xs">{p.evacuating_line || '—'}</td>
                          <td className="py-3 font-bold text-teal-700">{p.capacity_mw}</td>
                          <td className="py-3 text-slate-600">{p.owner || '—'}</td>
                          <td className="py-3 text-slate-600 font-semibold">{p.ppc_oem || <span className="text-amber-500 text-xs font-semibold">Pending</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ TAB: PPC PLANTS ═══════════════════ */}
          {activeTab === 'ppc-plants' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">PPC Plants</h2>
                  <p className="text-sm text-slate-500 font-medium">{plants.length} plants · {totalCapacity.toFixed(2)} MW total</p>
                </div>
                <div className="flex gap-3">
                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search plant, owner, WBES..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9 pr-4 py-2.5 text-sm border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none rounded-xl transition-all w-64 placeholder:text-slate-300"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {/* Export CSV */}
                  <button
                    onClick={() => exportToCSV(filteredPlants, displayStationName)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-teal-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="flex gap-5">
                {/* Table */}
                <div className={`bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden ${selectedPlant ? 'flex-1' : 'w-full'}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-xs text-slate-400 font-bold uppercase select-none">
                          <th className="px-4 py-3">Plant Name</th>
                          <th className="px-4 py-3">Evacuating Line</th>
                          <th className="px-4 py-3">MW</th>
                          <th className="px-4 py-3">Owner</th>
                          <th className="px-4 py-3">PPC OEM</th>
                          <th className="px-4 py-3">Ref kV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {filteredPlants.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm font-medium">No plants match your search.</td>
                          </tr>
                        ) : filteredPlants.map(p => (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPlant(selectedPlant?.id === p.id ? null : p)}
                            className={`cursor-pointer transition-colors hover:bg-teal-50/40 ${selectedPlant?.id === p.id ? 'bg-teal-50 border-l-2 border-teal-400' : ''}`}
                          >
                            <td className="px-4 py-3 font-semibold text-slate-800 max-w-[160px]">
                              <div className="truncate">{p.plant_name}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium">{p.evacuating_line || '—'}</td>
                            <td className="px-4 py-3 font-bold text-teal-700">{p.capacity_mw}</td>
                            <td className="px-4 py-3 text-slate-600">{p.owner || '—'}</td>
                            <td className="px-4 py-3 text-slate-700 font-medium">{p.ppc_oem || <span className="text-amber-500 text-xs font-semibold">Pending</span>}</td>
                            <td className="px-4 py-3 text-slate-600">{p.ppc_reference_voltage_kv ? `${p.ppc_reference_voltage_kv} kV` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detail side panel */}
                {selectedPlant && (
                  <div className="w-80 flex-shrink-0 bg-white border border-slate-100 rounded-2xl shadow-sm p-5 overflow-y-auto max-h-[calc(100vh-200px)]">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 leading-snug">{selectedPlant.plant_name}</h3>
                        <StatusBadge status={selectedPlant.status} />
                      </div>
                      <button onClick={() => setSelectedPlant(null)} className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-0">
                      <div className="text-xs font-bold text-teal-600 uppercase tracking-widest py-2 border-b border-slate-100 mb-1">General</div>
                      <InfoRow label="WBES Acronym" value={selectedPlant.wbes_acronym} />
                      <InfoRow label="Capacity" value={selectedPlant.capacity_mw ? `${selectedPlant.capacity_mw} MW` : null} />
                      <InfoRow label="Owner" value={selectedPlant.owner} />
                      <InfoRow label="Evacuating Line" value={selectedPlant.evacuating_line} />
                      <InfoRow label="Point of Interconnection" value={selectedPlant.poi} />

                      <div className="text-xs font-bold text-teal-600 uppercase tracking-widest py-2 border-b border-slate-100 mt-3 mb-1">PPC Configuration</div>
                      <InfoRow label="OEM" value={selectedPlant.ppc_oem} />
                      <InfoRow label="Mode of Control" value={selectedPlant.ppc_mode_of_control} />
                      <InfoRow label="Reference Point" value={selectedPlant.ppc_reference_point} />
                      <InfoRow label="Reference Voltage" value={selectedPlant.ppc_reference_voltage_kv ? `${selectedPlant.ppc_reference_voltage_kv} kV` : null} />
                      <InfoRow label="Voltage Deadband" value={selectedPlant.ppc_voltage_deadband_pct} />
                      <InfoRow label="Voltage Droop" value={selectedPlant.ppc_voltage_droop_pct} />
                      <InfoRow label="Max Q Injection" value={selectedPlant.max_reactive_power_injection_mvar ? `${selectedPlant.max_reactive_power_injection_mvar} MVAr` : null} />
                      <InfoRow label="Max Q Absorption" value={selectedPlant.max_reactive_power_absorption_mvar ? `${selectedPlant.max_reactive_power_absorption_mvar} MVAr` : null} />
                      <InfoRow label="Comm Time" value={selectedPlant.ppc_comm_time_ms ? `${selectedPlant.ppc_comm_time_ms} ms` : null} />
                      <InfoRow label="Sampling Time" value={selectedPlant.ppc_sampling_time_ms ? `${selectedPlant.ppc_sampling_time_ms} ms` : null} />
                      <InfoRow label="Total Exec Time" value={selectedPlant.ppc_total_exec_time_ms ? `${selectedPlant.ppc_total_exec_time_ms} ms` : null} />

                      <div className="text-xs font-bold text-teal-600 uppercase tracking-widest py-2 border-b border-slate-100 mt-3 mb-1">Frequency Control</div>
                      <InfoRow label="Freq Control Mode" value={selectedPlant.freq_control_mode} />
                      <InfoRow label="Freq Deadband" value={selectedPlant.freq_deadband} />
                      <InfoRow label="Freq Droop" value={selectedPlant.freq_droop_pct} />
                      <InfoRow label="Power Red. @50.3Hz" value={selectedPlant.power_reduction_at_50_3hz} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════ TAB: PROFILE ═══════════════════ */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-3xl animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Station Profile</h2>
                <p className="text-sm text-slate-500 font-medium">Account information and plant registry</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Station info */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">Station Details</h3>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Station Name</span>
                    <span className="text-sm font-bold text-slate-800">{station?.name || displayStationName}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Login ID</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">{station?.login_id || user?.email}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Capacity (Design)</span>
                    <span className="text-sm font-bold text-teal-700">{station?.total_capacity_mw ? `${station.total_capacity_mw} MW` : '—'}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Actual PPC Capacity</span>
                    <span className="text-sm font-bold text-emerald-700">{totalCapacity.toFixed(2)} MW</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Account Role</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 border border-teal-100 text-teal-700 bg-teal-50 rounded-full">Pooling Station</span>
                  </div>
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-semibold">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Read-only access — contact admin for changes
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">Station Statistics</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Total PPC Plants', value: plants.length, color: 'text-teal-700' },
                      { label: 'With PPC Data', value: withPpcData, color: 'text-emerald-700' },
                      { label: 'Pending Data Entry', value: pendingData, color: 'text-amber-600' },
                      { label: 'Active Plants', value: plants.filter(p => p.status === 'active').length, color: 'text-emerald-700' },
                      { label: 'Under Maintenance', value: plants.filter(p => p.status === 'maintenance').length, color: 'text-amber-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">{label}</span>
                        <span className={`text-lg font-extrabold ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Plant list */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-4">All Plants Under This Station</h3>
                <div className="space-y-2">
                  {plants.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-xl hover:bg-teal-50/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-5 text-right">{idx + 1}</span>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{p.plant_name}</div>
                          <div className="text-xs text-slate-400">{p.wbes_acronym || 'No WBES'} · {p.owner || 'Unknown owner'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-teal-700">{p.capacity_mw} MW</span>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StationDashboard;
