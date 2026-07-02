import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { plantsAPI, invertersAPI, ppcPlantsAPI, uploadAPI, poolingStationsAPI, BASE_URL } from '../services/api';

const PlantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [plant, setPlant] = useState(null);
  const [inverters, setInverters] = useState([]);
  const [ppcData, setPpcData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [poolingStations, setPoolingStations] = useState([]);

  // Tab State: 'inverters' | 'svgs' | 'ppc'
  const [activeTab, setActiveTab] = useState('inverters');

  // Master Forms / Screen 2 Selected Equipment States
  const [selectedInverterForSettings, setSelectedInverterForSettings] = useState(null);
  const [selectedSvgForSettings, setSelectedSvgForSettings] = useState(null);

  // Historic Previews State
  const [historyPreviewModal, setHistoryPreviewModal] = useState({ isOpen: false, type: '', data: null });

  // Uploaded File Metadata States
  const [inverterUploadedFile, setInverterUploadedFile] = useState('');
  const [svgUploadedFile, setSvgUploadedFile] = useState('');
  const [ppcUploadedFile, setPpcUploadedFile] = useState('');

  // Auto-calculation inputs for Equipment Master Forms
  const [invCount, setInvCount] = useState('');
  const [invUnitCap, setInvUnitCap] = useState('');
  const [invTotalCap, setInvTotalCap] = useState('');

  const [svgCount, setSvgCount] = useState('');
  const [svgUnitCap, setSvgUnitCap] = useState('');
  const [svgTotalCap, setSvgTotalCap] = useState('');

  // Modals state
  const [plantModalOpen, setPlantModalOpen] = useState(false);
  const [editConnectionType, setEditConnectionType] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editState, setEditState] = useState('');

  const handleOpenEditPlantModal = () => {
    if (plant) {
      setEditConnectionType(plant.connection_type || '');
      setEditRegion(plant.region || '');
      setEditState(plant.state || '');
    }
    setPlantModalOpen(true);
  };

  // Synchronize dynamic capacity inputs
  useEffect(() => {
    const qty = parseInt(invCount, 10);
    const mw = parseFloat(invUnitCap);
    if (!isNaN(qty) && !isNaN(mw)) {
      setInvTotalCap((qty * mw).toFixed(4));
    }
  }, [invCount, invUnitCap]);

  useEffect(() => {
    const qty = parseInt(svgCount, 10);
    const mvar = parseFloat(svgUnitCap);
    if (!isNaN(qty) && !isNaN(mvar)) {
      setSvgTotalCap((qty * mvar).toFixed(3));
    }
  }, [svgCount, svgUnitCap]);

  // Load All Plant Data
  const loadPlantData = async () => {
    try {
      const [data, psData] = await Promise.all([
        plantsAPI.getById(id),
        poolingStationsAPI.getAll().catch(() => ({ poolingStations: [] }))
      ]);
      setPlant(data.plant);
      setInverters(data.inverters);
      setPoolingStations(psData.poolingStations || []);

      // Fetch PPC details
      try {
        const ppcRes = await ppcPlantsAPI.getAll({ power_plant_id: id });
        if (ppcRes.ppcPlants && ppcRes.ppcPlants.length > 0) {
          setPpcData(ppcRes.ppcPlants[0]);
        } else {
          setPpcData(null);
        }
      } catch (ppcErr) {
        console.error('Failed to load PPC details for plant:', ppcErr);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading grid plant details.', 'error');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlantData();
  }, [id]);

  // Determine Plant Type dynamically
  const getPlantType = () => {
    if (!plant) return 'Solar';
    const nameLower = plant.name.toLowerCase();
    if (nameLower.includes('wind')) return 'Wind';
    if (nameLower.includes('bess') || nameLower.includes('battery') || nameLower.includes('storage')) return 'BESS';
    if (nameLower.includes('hybrid')) return 'Hybrid';
    return 'Solar';
  };

  // Save Plant Master Info card
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
      company_group: formData.get('company_group') || null,
      pooling_station: selectedStationName || null,
      pooling_station_id,
      connection_type: formData.get('connection_type') || null,
      region: formData.get('connection_type') === 'ISTS CONNECTED' ? (formData.get('region') || null) : null,
      state: formData.get('connection_type') === 'INTRA-STATE CONNECTED' ? (formData.get('state') || null) : null,
    };

    try {
      await plantsAPI.update(id, plantData);

      // Upsert PPC reference information too
      const ppcOEM = formData.get('ppc_oem') || '';
      const evacLine = formData.get('evacuating_line') || '';
      const poi = formData.get('poi') || '';

      if (ppcData) {
        await ppcPlantsAPI.update(ppcData.id, {
          plant_name: ppcData.plant_name,
          wbes_acronym: ppcData.wbes_acronym,
          capacity_mw: ppcData.capacity_mw,
          evacuating_line: evacLine,
          poi: poi,
          owner: plantData.owner,
          pooling_station_id: ppcData.pooling_station_id,
          power_plant_id: ppcData.power_plant_id,
          ppc_oem: ppcOEM,
          ppc_mode_of_control: ppcData.ppc_mode_of_control,
          ppc_reference_point: ppcData.ppc_reference_point,
          ppc_reference_voltage_kv: ppcData.ppc_reference_voltage_kv,
          ppc_voltage_deadband_pct: ppcData.ppc_voltage_deadband_pct,
          ppc_voltage_droop_pct: ppcData.ppc_voltage_droop_pct,
          max_reactive_power_injection_mvar: ppcData.max_reactive_power_injection_mvar,
          max_reactive_power_absorption_mvar: ppcData.max_reactive_power_absorption_mvar,
          ppc_comm_time_ms: ppcData.ppc_comm_time_ms,
          ppc_sampling_time_ms: ppcData.ppc_sampling_time_ms,
          ppc_total_exec_time_ms: ppcData.ppc_total_exec_time_ms,
          freq_control_mode: ppcData.freq_control_mode,
          freq_deadband: ppcData.freq_deadband,
          freq_droop_pct: ppcData.freq_droop_pct,
          power_reduction_at_50_3hz: ppcData.power_reduction_at_50_3hz,
          history: ppcData.history
        });
      } else {
        const selectedStationName = formData.get('pooling_station') || '';
        const matchingStation = poolingStations.find(s => s.name === selectedStationName);
        const stationId = matchingStation ? matchingStation.id : 1;

        await ppcPlantsAPI.create({
          power_plant_id: parseInt(id, 10),
          plant_name: plantData.name + ' PPC',
          pooling_station_id: stationId,
          ppc_oem: ppcOEM,
          evacuating_line: evacLine,
          poi: poi,
          owner: plantData.owner,
        });
      }

      showToast('Power plant master details updated successfully.', 'success');
      setPlantModalOpen(false);
      loadPlantData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update power plant details.', 'error');
    }
  };

  // Equipment Form Submissions (Create Equipment Master / Tab 1 & Tab 2)
  const handleCreateInverter = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const count = parseInt(formData.get('count'), 10);
    const capacity_mw = parseFloat(formData.get('capacity_mw'));
    const total_capacity_mw = parseFloat(formData.get('total_capacity_mw')) || (count * capacity_mw);

    const invData = {
      plant_id: parseInt(id, 10),
      make: formData.get('make'),
      model: formData.get('model'),
      type: formData.get('type'),
      rating_mva: parseFloat(formData.get('rating_mva')) || null,
      capacity_mw,
      count,
      total_capacity_mw,
      pooling_station: plant?.pooling_station || null,
      owner: plant?.owner || null,
    };

    try {
      const res = await invertersAPI.create(invData);
      showToast('Equipment Master created. Continue to protection settings.', 'success');

      // Auto-focus protection settings Screen 3
      setSelectedInverterForSettings(res.inverter);

      // Clear form calculations state
      setInvCount('');
      setInvUnitCap('');
      setInvTotalCap('');
      loadPlantData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save equipment record.', 'error');
    }
  };

  const handleCreateSvg = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const count = parseInt(formData.get('count'), 10);
    const rating_mvar = parseFloat(formData.get('rating_mva')); // rating in MVAr mapped to rating_mva
    const total_capacity_mvar = parseFloat(formData.get('total_capacity_mw')) || (count * rating_mvar);

    const svgData = {
      plant_id: parseInt(id, 10),
      make: formData.get('make'),
      model: formData.get('model'),
      type: 'SVG',
      rating_mva: rating_mvar,
      capacity_mw: rating_mvar, // Set capacity_mw to rating_mvar in MW
      count,
      total_capacity_mw: total_capacity_mvar,
      pooling_station: plant?.pooling_station || null,
      owner: plant?.owner || null,
    };

    try {
      const res = await invertersAPI.create(svgData);
      showToast('SVG Master created. Continue to protection settings.', 'success');

      // Focus protection settings Screen 3
      setSelectedSvgForSettings(res.inverter);

      // Clear values
      setSvgCount('');
      setSvgUnitCap('');
      setSvgTotalCap('');
      loadPlantData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save SVG record.', 'error');
    }
  };

  // Save Protection Settings revisions (Screen 3)
  const handleSaveProtectionSettings = async (e, typeStr) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const currentInverter = typeStr === 'SVG' ? selectedSvgForSettings : selectedInverterForSettings;

    // Build LVRT / HVRT schema structures
    const updatedLvrt = {
      triggering_threshold_pu: parseFloat(formData.get('lvrt_trigger')),
      uv_stage1_voltage_pu: parseFloat(formData.get('uv_stage1_v')),
      uv_stage1_time_ms: parseInt(formData.get('uv_stage1_t'), 10),
      uv_stage2_voltage_pu: parseFloat(formData.get('uv_stage2_v')),
      uv_stage2_time_ms: parseInt(formData.get('uv_stage2_t'), 10),
      uv_stage3_voltage_pu: parseFloat(formData.get('uv_stage3_v')),
      uv_stage3_time_ms: parseInt(formData.get('uv_stage3_t'), 10),
      k_factor: parseFloat(formData.get('lvrt_k'))
    };

    const updatedHvrt = {
      triggering_threshold_pu: parseFloat(formData.get('hvrt_trigger')),
      ov_stage1_voltage_pu: parseFloat(formData.get('ov_stage1_v')),
      ov_stage1_time_ms: parseInt(formData.get('ov_stage1_t'), 10),
      ov_stage2_voltage_pu: parseFloat(formData.get('ov_stage2_v')),
      ov_stage2_time_ms: parseInt(formData.get('ov_stage2_t'), 10),
      ov_stage3_voltage_pu: parseFloat(formData.get('ov_stage3_v')),
      ov_stage3_time_ms: parseInt(formData.get('ov_stage3_t'), 10),
      k_factor: parseFloat(formData.get('hvrt_k'))
    };

    // Generate revision snapshot
    const revision = {
      date_changed: formData.get('date_changed') || new Date().toISOString().split('T')[0],
      changed_by: user?.email || user?.username || 'admin@energymgmt.com',
      file_name: typeStr === 'SVG' ? svgUploadedFile : inverterUploadedFile,
      remarks: formData.get('remarks') || '',
      lvrt: updatedLvrt,
      hvrt: updatedHvrt,
    };

    const newHistory = [revision, ...(currentInverter.history || [])];

    const updatedData = {
      make: currentInverter.make,
      model: currentInverter.model,
      type: currentInverter.type,
      rating_mva: currentInverter.rating_mva,
      capacity_mw: currentInverter.capacity_mw,
      count: currentInverter.count,
      total_capacity_mw: currentInverter.total_capacity_mw,
      pooling_station: currentInverter.pooling_station,
      owner: currentInverter.owner,
      lvrt: updatedLvrt,
      hvrt: updatedHvrt,
      history: newHistory
    };

    try {
      await invertersAPI.update(currentInverter.id, updatedData);
      showToast('Settings saved as new compliant version.', 'success');

      // Return to Master View
      if (typeStr === 'SVG') {
        setSelectedSvgForSettings(null);
        setSvgUploadedFile('');
      } else {
        setSelectedInverterForSettings(null);
        setInverterUploadedFile('');
      }
      loadPlantData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save settings revision.', 'error');
    }
  };

  // Delete a protection settings revision (Admin only)
  const handleDeleteRevision = async (rev, idx, typeStr) => {
    if (user?.role !== 'admin') {
      showToast('Only administrators can delete revisions.', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this settings revision? This action cannot be undone.')) {
      return;
    }

    const currentEquipment = typeStr === 'SVG' ? selectedSvgForSettings : selectedInverterForSettings;
    if (!currentEquipment) return;

    // Filter out the deleted revision from history
    const updatedHistory = (currentEquipment.history || []).filter((_, i) => i !== idx);
    const updatedEquipment = {
      make: currentEquipment.make,
      model: currentEquipment.model,
      type: currentEquipment.type,
      rating_mva: currentEquipment.rating_mva,
      capacity_mw: currentEquipment.capacity_mw,
      count: currentEquipment.count,
      total_capacity_mw: currentEquipment.total_capacity_mw,
      pooling_station: currentEquipment.pooling_station,
      owner: currentEquipment.owner,
      lvrt: currentEquipment.lvrt,
      hvrt: currentEquipment.hvrt,
      history: updatedHistory
    };

    try {
      // 1. Delete physical file from server if it has one
      if (rev.file_name) {
        try {
          await uploadAPI.deleteFile(rev.file_name);
        } catch (fileErr) {
          console.error('Failed to delete physical file from local storage:', fileErr);
        }
      }

      // 2. Update equipment history in database
      await invertersAPI.update(currentEquipment.id, updatedEquipment);
      showToast('Settings revision deleted successfully.', 'success');

      // 3. Update local state
      if (typeStr === 'SVG') {
        setSelectedSvgForSettings(updatedEquipment);
      } else {
        setSelectedInverterForSettings(updatedEquipment);
      }
      loadPlantData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete settings revision.', 'error');
    }
  };

  // Delete an inverter/SVG group entry (Admin only)
  const handleDeleteInverter = async (inv) => {
    if (user?.role !== 'admin') {
      showToast('Only administrators can delete equipment entries.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete "${inv.make} ${inv.model}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await invertersAPI.delete(inv.id);
      showToast(`"${inv.make} ${inv.model}" deleted successfully.`, 'success');
      loadPlantData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete equipment entry.', 'error');
    }
  };

  // Save PPC Controller config (Screen 4)
  const handleSavePpcSettings = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const isFreqEnabled = formData.get('freq_control_mode_enabled') === 'true';
    const hasPowerReduction = formData.get('power_reduction_at_50_3hz') === 'true';

    const matchingStation = poolingStations.find(s => s.name === plant?.pooling_station);
    const fallbackStationId = matchingStation ? matchingStation.id : (poolingStations[0] ? poolingStations[0].id : 1);

    const ppcFields = {
      power_plant_id: parseInt(id, 10),
      plant_name: ppcData?.plant_name || plant.name + '_PPC',
      pooling_station_id: ppcData?.pooling_station_id || fallbackStationId,
      ppc_oem: ppcData?.ppc_oem || 'ABB',
      ppc_mode_of_control: formData.get('ppc_mode_of_control') || '',
      ppc_reference_point: formData.get('ppc_reference_point') || '',
      ppc_reference_voltage_kv: formData.get('ppc_reference_voltage_kv') || '',
      ppc_voltage_deadband_pct: formData.get('ppc_voltage_deadband_pct') || '',
      ppc_voltage_droop_pct: formData.get('ppc_voltage_droop_pct') || '',
      max_reactive_power_injection_mvar: formData.get('max_reactive_power_injection_mvar') || '',
      max_reactive_power_absorption_mvar: formData.get('max_reactive_power_absorption_mvar') || '',
      ppc_comm_time_ms: parseFloat(formData.get('ppc_comm_time_ms')) || null,
      ppc_sampling_time_ms: parseFloat(formData.get('ppc_sampling_time_ms')) || null,
      ppc_total_exec_time_ms: formData.get('ppc_total_exec_time_ms') || '',
      freq_control_mode: isFreqEnabled ? 'Enabled' : 'Disabled',
      freq_deadband: formData.get('freq_deadband') || '',
      freq_droop_pct: formData.get('freq_droop_pct') || '',
      power_reduction_at_50_3hz: hasPowerReduction ? 'Yes' : 'No',
      owner: formData.get('owner') || '',
      kp: formData.get('kp') !== '' && formData.get('kp') !== null ? parseFloat(formData.get('kp')) : null,
      ti: formData.get('ti') !== '' && formData.get('ti') !== null ? parseFloat(formData.get('ti')) : null,
      remarks: formData.get('remarks') || '',
    };

    // Calculate audit revision
    const snapshot = {
      date_changed: formData.get('date_changed') || new Date().toISOString().split('T')[0],
      changed_by: user?.email || user?.username || 'admin@energymgmt.com',
      file_name: ppcUploadedFile,
      ppc_mode_of_control: ppcFields.ppc_mode_of_control,
      ppc_reference_point: ppcFields.ppc_reference_point,
      ppc_reference_voltage_kv: ppcFields.ppc_reference_voltage_kv,
      ppc_voltage_deadband_pct: ppcFields.ppc_voltage_deadband_pct,
      ppc_voltage_droop_pct: ppcFields.ppc_voltage_droop_pct,
      max_reactive_power_injection_mvar: ppcFields.max_reactive_power_injection_mvar,
      max_reactive_power_absorption_mvar: ppcFields.max_reactive_power_absorption_mvar,
      ppc_comm_time_ms: ppcFields.ppc_comm_time_ms,
      ppc_sampling_time_ms: ppcFields.ppc_sampling_time_ms,
      ppc_total_exec_time_ms: ppcFields.ppc_total_exec_time_ms,
      freq_control_mode: ppcFields.freq_control_mode,
      freq_deadband: ppcFields.freq_deadband,
      freq_droop_pct: ppcFields.freq_droop_pct,
      power_reduction_at_50_3hz: ppcFields.power_reduction_at_50_3hz,
      owner: ppcFields.owner,
      kp: ppcFields.kp,
      ti: ppcFields.ti,
      remarks: ppcFields.remarks
    };

    const newHistory = [snapshot, ...(ppcData?.history || [])];
    ppcFields.history = newHistory;

    try {
      if (ppcData) {
        await ppcPlantsAPI.update(ppcData.id, ppcFields);
        showToast('PPC configuration saved as new compliant version.', 'success');
      } else {
        await ppcPlantsAPI.create(ppcFields);
        showToast('PPC configuration registered successfully.', 'success');
      }
      setPpcUploadedFile('');
      loadPlantData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update PPC settings.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500 font-sans">Syncing plant protection modules...</p>
      </div>
    );
  }

  if (!plant) return null;

  // Filter inverters lists
  const standardInvertersList = inverters.filter(i => i.type !== 'SVG');
  const svgList = inverters.filter(i => i.type === 'SVG');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">

        {/* Navigation Breadcrumb */}
        <nav className="text-sm font-semibold text-slate-400 select-none flex items-center gap-2">
          <button onClick={() => navigate('/dashboard')} className="hover:text-teal-600 transition-colors">
            My Plants
          </button>
          <span>&gt;</span>
          <span className="text-slate-800">{plant.name}</span>
        </nav>

        {/* Read Only Info Banner */}
        {!plant.can_write && (
          <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl flex items-center gap-3 font-semibold text-sm">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Read-Only Level: Editing configurations is disabled for this user.</span>
          </div>
        )}

        {/* Plant Master Info Card (Screen 1 & 3 Metadata) */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{plant.name}</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">RE Plant Master Information Profile</p>
            </div>
            {plant.can_write && (
              <button
                onClick={handleOpenEditPlantModal}
                className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl text-xs font-bold transition-all border border-teal-100/50 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Plant Details
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Plant Type</span>
              <span className="font-semibold text-slate-700">{getPlantType()}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Pooling Station</span>
              <span className="font-semibold text-slate-700">{plant.pooling_station || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Rated Capacity</span>
              <span className="font-bold text-slate-800">{plant.capacity_mw} MW</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Commissioned Date</span>
              <span className="font-semibold text-slate-700">{plant.commissioned_date ? new Date(plant.commissioned_date).toLocaleDateString() : '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">PPC OEM</span>
              <span className="font-semibold text-slate-700">{ppcData?.ppc_oem || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Evacuating Line</span>
              <span className="font-semibold text-slate-700 truncate block max-w-[200px]" title={ppcData?.evacuating_line}>{ppcData?.evacuating_line || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">POI (Point of Interconnection)</span>
              <span className="font-semibold text-slate-700 block max-w-[200px]" title={ppcData?.poi}>{ppcData?.poi || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Owner name</span>
              <span className="font-semibold text-slate-700">{plant.owner || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Connection Type</span>
              <span className="font-semibold text-slate-700">{plant.connection_type || '—'}</span>
            </div>
            {plant.connection_type === 'ISTS CONNECTED' ? (
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Region</span>
                <span className="font-semibold text-slate-700">{plant.region || '—'}</span>
              </div>
            ) : plant.connection_type === 'INTRA-STATE CONNECTED' ? (
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">State</span>
                <span className="font-semibold text-slate-700">{plant.state || '—'}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 p-1 bg-slate-200/60 border border-slate-350/20 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('inverters')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'inverters' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            Inverters / WTGs / BESS PCS
          </button>
          <button
            onClick={() => setActiveTab('svgs')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'svgs' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            SVGs (Static Var Generators)
          </button>
          <button
            onClick={() => setActiveTab('ppc')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === 'ppc' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            PPC Settings Configuration
          </button>
        </div>

        {/* ======================= TAB 1: INVERTERS / WTGs / BESS PCS ======================= */}
        {activeTab === 'inverters' && (
          <div className="space-y-6">
            {selectedInverterForSettings === null ? (
              <>
                {/* Equipment Master Form (Screen 2 Form) */}
                {plant.can_write && (
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Inverter / WTG / BESS PCS — equipment master</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Register new grid power converter makes or models</p>
                    </div>
                    <form onSubmit={handleCreateInverter} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Inverter / WTG make</label>
                        <input
                          type="text"
                          name="make"
                          required
                          placeholder="e.g. Sungrow"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Inverter / WTG model no.</label>
                        <input
                          type="text"
                          name="model"
                          required
                          placeholder="e.g. SG3125HV-MV"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Rating in MVA @ 50°C</label>
                        <input
                          type="number"
                          step="0.001"
                          name="rating_mva"
                          required
                          placeholder="3.125"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Number of Inverters</label>
                        <input
                          type="number"
                          name="count"
                          required
                          value={invCount}
                          onChange={(e) => setInvCount(e.target.value)}
                          placeholder="80"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity per Unit (MW)</label>
                        <input
                          type="number"
                          step="0.0001"
                          name="capacity_mw"
                          required
                          value={invUnitCap}
                          onChange={(e) => setInvUnitCap(e.target.value)}
                          placeholder="3.125"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Total capacity (MW)</label>
                        <input
                          type="number"
                          step="0.001"
                          name="total_capacity_mw"
                          value={invTotalCap}
                          onChange={(e) => setInvTotalCap(e.target.value)}
                          placeholder="auto-calculated"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-slate-50 font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Pooling station name</label>
                        <select
                          name="pooling_station"
                          defaultValue={plant.pooling_station || ''}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                        >
                          <option value="">— Select Pooling Station —</option>
                          {poolingStations.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Owner</label>
                        <input
                          type="text"
                          name="owner"
                          defaultValue={plant.owner || ''}
                          placeholder="e.g. ACME Renewables"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Element Type</label>
                        <select
                          name="type"
                          defaultValue="Central"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                        >
                          <option value="Central">Central Inverters</option>
                          <option value="String">String Inverters</option>
                          <option value="WTG">WTG (Wind)</option>
                          <option value="BESS">BESS PCS (Battery)</option>
                          <option value="SVG">SVG</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 lg:col-span-3 flex justify-end items-end pt-4">
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-md shadow-teal-50"
                        >
                          Save & continue to settings
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Inverters list Table (Screen 2 Table) */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Existing equipment in this plant</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase">
                          <th className="p-3">Make</th>
                          <th className="p-3">Model</th>
                          <th className="p-3">Rating (MVA)</th>
                          <th className="p-3">Qty</th>
                          <th className="p-3">Type</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {standardInvertersList.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="p-8 text-center text-slate-400 font-medium">
                              No inverter groups registered.
                            </td>
                          </tr>
                        ) : (
                          standardInvertersList.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-semibold text-slate-850">{inv.make}</td>
                              <td className="p-3 text-slate-600">{inv.model}</td>
                              <td className="p-3 text-slate-600 font-medium">{inv.rating_mva ? `${inv.rating_mva} MVA` : '—'}</td>
                              <td className="p-3 text-slate-700 font-bold">{inv.count}</td>
                              <td className="p-3 text-slate-500 font-semibold">{inv.type}</td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedInverterForSettings(inv)}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 font-bold rounded-lg text-xs transition-all"
                                  >
                                    Settings
                                  </button>
                                  {user?.role === 'admin' && (
                                    <button
                                      onClick={() => handleDeleteInverter(inv)}
                                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg text-xs transition-all"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              /* Protection Settings (Screen 3 Form) */
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Protection settings — LVRT / HVRT</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {selectedInverterForSettings.make} {selectedInverterForSettings.model} — {plant.name}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedInverterForSettings(null); setInverterUploadedFile(''); }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                  >
                    Back to list
                  </button>
                </div>

                <form onSubmit={(e) => handleSaveProtectionSettings(e, 'Inverter')} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LVRT Panel */}
                    <div className="bg-[#f0f4f8] border border-blue-100 rounded-3xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider">LVRT (under-voltage)</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger threshold (pu)</label>
                          <input
                            type="number" step="0.001" name="lvrt_trigger" required
                            defaultValue={selectedInverterForSettings.lvrt?.triggering_threshold_pu ?? '0.90'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">UV stage 1 (pu)</label>
                          <input
                            type="number" step="0.001" name="uv_stage1_v" required
                            defaultValue={selectedInverterForSettings.lvrt?.uv_stage1_voltage_pu ?? '0.85'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="uv_stage1_t" required
                            defaultValue={selectedInverterForSettings.lvrt?.uv_stage1_time_ms ?? '500'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">UV stage 2 (pu)</label>
                          <input
                            type="number" step="0.001" name="uv_stage2_v" required
                            defaultValue={selectedInverterForSettings.lvrt?.uv_stage2_voltage_pu ?? '0.65'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="uv_stage2_t" required
                            defaultValue={selectedInverterForSettings.lvrt?.uv_stage2_time_ms ?? '300'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">UV stage 3 (pu)</label>
                          <input
                            type="number" step="0.001" name="uv_stage3_v" required
                            defaultValue={selectedInverterForSettings.lvrt?.uv_stage3_voltage_pu ?? '0.30'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="uv_stage3_t" required
                            defaultValue={selectedInverterForSettings.lvrt?.uv_stage3_time_ms ?? '150'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">K-factor</label>
                          <input
                            type="number" step="0.01" name="lvrt_k" required
                            defaultValue={selectedInverterForSettings.lvrt?.k_factor ?? '2.0'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* HVRT Panel */}
                    <div className="bg-[#fcf3f2] border border-rose-100 rounded-3xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <h4 className="text-sm font-bold text-rose-800 uppercase tracking-wider">HVRT (over-voltage)</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger threshold (pu)</label>
                          <input
                            type="number" step="0.001" name="hvrt_trigger" required
                            defaultValue={selectedInverterForSettings.hvrt?.triggering_threshold_pu ?? '1.10'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">OV stage 1 (pu)</label>
                          <input
                            type="number" step="0.001" name="ov_stage1_v" required
                            defaultValue={selectedInverterForSettings.hvrt?.ov_stage1_voltage_pu ?? '1.15'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="ov_stage1_t" required
                            defaultValue={selectedInverterForSettings.hvrt?.ov_stage1_time_ms ?? '500'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">OV stage 2 (pu)</label>
                          <input
                            type="number" step="0.001" name="ov_stage2_v" required
                            defaultValue={selectedInverterForSettings.hvrt?.ov_stage2_voltage_pu ?? '1.20'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="ov_stage2_t" required
                            defaultValue={selectedInverterForSettings.hvrt?.ov_stage2_time_ms ?? '200'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">OV stage 3 (pu)</label>
                          <input
                            type="number" step="0.001" name="ov_stage3_v" required
                            defaultValue={selectedInverterForSettings.hvrt?.ov_stage3_voltage_pu ?? '1.30'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="ov_stage3_t" required
                            defaultValue={selectedInverterForSettings.hvrt?.ov_stage3_time_ms ?? '100'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">K-factor</label>
                          <input
                            type="number" step="0.01" name="hvrt_k" required
                            defaultValue={selectedInverterForSettings.hvrt?.k_factor ?? '2.0'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File Upload, Remarks, Action Row */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Inverter/WTG downloaded settings file</label>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3 mt-1.5">
                            <input
                              type="file"
                              accept=".xlsx,.pdf,.csv"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  try {
                                    showToast('Uploading file...', 'info');
                                    const res = await uploadAPI.uploadFile(file, 'inverter');
                                    setInverterUploadedFile(res.filename);
                                    showToast('File uploaded successfully.', 'success');
                                  } catch (err) {
                                    showToast('Failed to upload file.', 'error');
                                    console.error(err);
                                  }
                                }
                              }}
                              className="hidden" id="inv-file-picker"
                            />
                            <label
                              htmlFor="inv-file-picker"
                              className="px-4 py-2 border border-slate-250 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              ↑ Upload file
                            </label>
                            {inverterUploadedFile && (
                              <span className="text-xs text-slate-500 font-semibold">{inverterUploadedFile}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Allowed formats: .xlsx, .pdf, .csv only</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Date setting was changed</label>
                        <input
                          type="date" name="date_changed" required
                          defaultValue={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Audit Note</label>
                        <textarea
                          name="remarks" rows="2" placeholder="Describe the reason for modification..."
                          className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                        ></textarea>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => { setSelectedInverterForSettings(null); setInverterUploadedFile(''); }}
                        className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm"
                      >
                        Cancel
                      </button>
                      {plant.can_write && (
                        <button
                          type="submit"
                          className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all"
                        >
                          Save as new version
                        </button>
                      )}
                    </div>
                  </div>
                </form>

                {/* Audit Revision History Table */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Version history</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase">
                          <th className="p-3">Date changed</th>
                          <th className="p-3">Changed by</th>
                          <th className="p-3">File</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {!(selectedInverterForSettings.history) || selectedInverterForSettings.history.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="p-8 text-center text-slate-400 font-medium">
                              No historic revisions logged.
                            </td>
                          </tr>
                        ) : (
                          selectedInverterForSettings.history.map((rev, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3 font-semibold text-slate-800">{rev.date_changed}</td>
                              <td className="p-3 text-slate-500">{rev.changed_by}</td>
                              <td className="p-3 text-slate-500 font-mono text-xs">
                                {rev.file_name ? (
                                  <a
                                    href={`${BASE_URL}/api/upload/download/${rev.file_name}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-teal-600 font-bold hover:underline flex items-center gap-1"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    {rev.file_name.substring(0, 20) + (rev.file_name.length > 20 ? '...' : '')}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="p-3 text-right flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setHistoryPreviewModal({ isOpen: true, type: 'inverter', data: rev })}
                                  className="px-3 py-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition-all"
                                >
                                  View
                                </button>
                                {user?.role === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRevision(rev, idx, 'Inverter')}
                                    className="px-3 py-1 border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold rounded-lg text-xs transition-all"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 2: SVGs ======================= */}
        {activeTab === 'svgs' && (
          <div className="space-y-6">
            {selectedSvgForSettings === null ? (
              <>
                {/* SVG Equipment Master Form */}
                {plant.can_write && (
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">SVG (Static Var Generator) — equipment master</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Register Static Var Generator units</p>
                    </div>
                    <form onSubmit={handleCreateSvg} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">SVG make</label>
                        <input
                          type="text"
                          name="make"
                          required
                          placeholder="e.g. Sungrow"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">SVG model no.</label>
                        <input
                          type="text"
                          name="model"
                          required
                          placeholder="e.g. SVG-50MVAR"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">SVG Rating (MVAr)</label>
                        <input
                          type="number"
                          step="0.001"
                          name="rating_mva"
                          required
                          value={svgUnitCap}
                          onChange={(e) => setSvgUnitCap(e.target.value)}
                          placeholder="50"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Number of SVGs</label>
                        <input
                          type="number"
                          name="count"
                          required
                          value={svgCount}
                          onChange={(e) => setSvgCount(e.target.value)}
                          placeholder="2"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Total Capacity (MVAr)</label>
                        <input
                          type="number"
                          step="0.001"
                          name="total_capacity_mw"
                          value={svgTotalCap}
                          onChange={(e) => setSvgTotalCap(e.target.value)}
                          placeholder="auto-calculated"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-slate-50 font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Pooling station name</label>
                        <select
                          name="pooling_station"
                          defaultValue={plant.pooling_station || ''}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                        >
                          <option value="">— Select Pooling Station —</option>
                          {poolingStations.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Owner</label>
                        <input
                          type="text"
                          name="owner"
                          defaultValue={plant.owner || ''}
                          placeholder="e.g. ACME Renewables"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="md:col-span-2 lg:col-span-1 flex justify-end items-end pt-4">
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-md shadow-teal-50"
                        >
                          Save & continue to settings
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* SVG List Table */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Existing SVG equipment in this plant</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase">
                          <th className="p-3">Make</th>
                          <th className="p-3">Model</th>
                          <th className="p-3">Rating (MVAr)</th>
                          <th className="p-3">Qty</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {svgList.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-8 text-center text-slate-400 font-medium">
                              No Static Var Generators registered.
                            </td>
                          </tr>
                        ) : (
                          svgList.map((svg) => (
                            <tr key={svg.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-semibold text-slate-850">{svg.make}</td>
                              <td className="p-3 text-slate-600">{svg.model}</td>
                              <td className="p-3 text-slate-600 font-medium">{svg.rating_mva ? `${svg.rating_mva} MVAr` : '—'}</td>
                              <td className="p-3 text-slate-700 font-bold">{svg.count}</td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedSvgForSettings(svg)}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 font-bold rounded-lg text-xs transition-all"
                                  >
                                    Settings
                                  </button>
                                  {user?.role === 'admin' && (
                                    <button
                                      onClick={() => handleDeleteInverter(svg)}
                                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg text-xs transition-all"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              /* SVG Protection Settings (Screen 3 for SVGs) */
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Protection settings — SVG LVRT / HVRT</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {selectedSvgForSettings.make} {selectedSvgForSettings.model} — {plant.name}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedSvgForSettings(null); setSvgUploadedFile(''); }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                  >
                    Back to list
                  </button>
                </div>

                <form onSubmit={(e) => handleSaveProtectionSettings(e, 'SVG')} className="space-y-6">


                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LVRT Panel */}
                    <div className="bg-[#f0f4f8] border border-blue-100 rounded-3xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider">LVRT (under-voltage)</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger threshold (pu)</label>
                          <input
                            type="number" step="0.001" name="lvrt_trigger" required
                            defaultValue={selectedSvgForSettings.lvrt?.triggering_threshold_pu ?? '0.90'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">UV stage 1 (pu)</label>
                          <input
                            type="number" step="0.001" name="uv_stage1_v" required
                            defaultValue={selectedSvgForSettings.lvrt?.uv_stage1_voltage_pu ?? '0.85'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="uv_stage1_t" required
                            defaultValue={selectedSvgForSettings.lvrt?.uv_stage1_time_ms ?? '500'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">UV stage 2 (pu)</label>
                          <input
                            type="number" step="0.001" name="uv_stage2_v" required
                            defaultValue={selectedSvgForSettings.lvrt?.uv_stage2_voltage_pu ?? '0.65'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="uv_stage2_t" required
                            defaultValue={selectedSvgForSettings.lvrt?.uv_stage2_time_ms ?? '300'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">UV stage 3 (pu)</label>
                          <input
                            type="number" step="0.001" name="uv_stage3_v" required
                            defaultValue={selectedSvgForSettings.lvrt?.uv_stage3_voltage_pu ?? '0.30'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="uv_stage3_t" required
                            defaultValue={selectedSvgForSettings.lvrt?.uv_stage3_time_ms ?? '150'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">K-factor</label>
                          <input
                            type="number" step="0.01" name="lvrt_k" required
                            defaultValue={selectedSvgForSettings.lvrt?.k_factor ?? '2.0'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* HVRT Panel */}
                    <div className="bg-[#fcf3f2] border border-rose-100 rounded-3xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <h4 className="text-sm font-bold text-rose-800 uppercase tracking-wider">HVRT (over-voltage)</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger threshold (pu)</label>
                          <input
                            type="number" step="0.001" name="hvrt_trigger" required
                            defaultValue={selectedSvgForSettings.hvrt?.triggering_threshold_pu ?? '1.10'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">OV stage 1 (pu)</label>
                          <input
                            type="number" step="0.001" name="ov_stage1_v" required
                            defaultValue={selectedSvgForSettings.hvrt?.ov_stage1_voltage_pu ?? '1.15'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="ov_stage1_t" required
                            defaultValue={selectedSvgForSettings.hvrt?.ov_stage1_time_ms ?? '500'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">OV stage 2 (pu)</label>
                          <input
                            type="number" step="0.001" name="ov_stage2_v" required
                            defaultValue={selectedSvgForSettings.hvrt?.ov_stage2_voltage_pu ?? '1.20'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="ov_stage2_t" required
                            defaultValue={selectedSvgForSettings.hvrt?.ov_stage2_time_ms ?? '200'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">OV stage 3 (pu)</label>
                          <input
                            type="number" step="0.001" name="ov_stage3_v" required
                            defaultValue={selectedSvgForSettings.hvrt?.ov_stage3_voltage_pu ?? '1.30'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (ms)</label>
                          <input
                            type="number" name="ov_stage3_t" required
                            defaultValue={selectedSvgForSettings.hvrt?.ov_stage3_time_ms ?? '100'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">K-factor</label>
                          <input
                            type="number" step="0.01" name="hvrt_k" required
                            defaultValue={selectedSvgForSettings.hvrt?.k_factor ?? '2.0'}
                            className="w-full px-3 py-2 text-sm border border-slate-250 bg-white rounded-xl outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SVG Actions */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">SVG downloaded settings file</label>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3 mt-1.5">
                            <input
                              type="file"
                              accept=".xlsx,.pdf,.csv"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  try {
                                    showToast('Uploading file...', 'info');
                                    const res = await uploadAPI.uploadFile(file, 'inverter');
                                    setSvgUploadedFile(res.filename);
                                    showToast('File uploaded successfully.', 'success');
                                  } catch (err) {
                                    showToast('Failed to upload file.', 'error');
                                    console.error(err);
                                  }
                                }
                              }}
                              className="hidden" id="svg-file-picker"
                            />
                            <label
                              htmlFor="svg-file-picker"
                              className="px-4 py-2 border border-slate-255 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              ↑ Upload file
                            </label>
                            {svgUploadedFile && (
                              <span className="text-xs text-slate-500 font-semibold">{svgUploadedFile}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Allowed formats: .xlsx, .pdf, .csv only</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Date setting was changed</label>
                        <input
                          type="date" name="date_changed" required
                          defaultValue={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 text-sm border border-slate-255 bg-white rounded-xl outline-none mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Audit Note</label>
                        <textarea
                          name="remarks" rows="2" placeholder="Describe the reason for modification..."
                          className="w-full px-3 py-2 text-sm border border-slate-255 bg-white rounded-xl outline-none"
                        ></textarea>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => { setSelectedSvgForSettings(null); setSvgUploadedFile(''); }}
                        className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm"
                      >
                        Cancel
                      </button>
                      {plant.can_write && (
                        <button
                          type="submit"
                          className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all"
                        >
                          Save as new version
                        </button>
                      )}
                    </div>
                  </div>
                </form>

                {/* Audit Revision History Table */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Version history</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase">
                          <th className="p-3">Date changed</th>
                          <th className="p-3">Changed by</th>
                          <th className="p-3">File</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {!(selectedSvgForSettings.history) || selectedSvgForSettings.history.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="p-8 text-center text-slate-400 font-medium">
                              No historic revisions logged.
                            </td>
                          </tr>
                        ) : (
                          selectedSvgForSettings.history.map((rev, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3 font-semibold text-slate-800">{rev.date_changed}</td>
                              <td className="p-3 text-slate-500">{rev.changed_by}</td>
                              <td className="p-3 text-slate-500 font-mono text-xs">
                                {rev.file_name ? (
                                  <a
                                    href={`${BASE_URL}/api/upload/download/${rev.file_name}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-teal-600 font-bold hover:underline flex items-center gap-1"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    {rev.file_name.substring(0, 20) + (rev.file_name.length > 20 ? '...' : '')}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="p-3 text-right flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setHistoryPreviewModal({ isOpen: true, type: 'svg', data: rev })}
                                  className="px-3 py-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition-all"
                                >
                                  View
                                </button>
                                {user?.role === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRevision(rev, idx, 'SVG')}
                                    className="px-3 py-1 border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold rounded-lg text-xs transition-all"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 3: PPC SETTINGS ======================= */}
        {activeTab === 'ppc' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Power plant controller (PPC) settings</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {plant.name} — OEM: {ppcData?.ppc_oem || 'ABB'} — Screen 4 of 4
              </p>
            </div>

            {poolingStations.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm text-center">
                <span className="text-5xl">⚠️</span>
                <h4 className="text-lg font-bold text-slate-800 mt-4">No Pooling Stations Registered</h4>
                <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                  A pooling station must be registered in the system first to configure Power Plant Controller (PPC) settings.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Please ask an administrator to register a pooling station first.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSavePpcSettings} className="space-y-6">
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">

                  {/* Control mode & reference */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Control mode & reference</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Mode of control</label>
                        <select
                          name="ppc_mode_of_control"
                          defaultValue={ppcData?.ppc_mode_of_control || 'Voltage control'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                        >
                          <option value="Voltage control">Voltage control</option>
                          <option value="PF Control">PF Control</option>
                          <option value="Q Control">Q Control</option>
                          <option value="Q(V) Mode">Q(V) Mode</option>
                          <option value="V-Mode">V-Mode</option>
                          <option value="AGC">AGC</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Reference point</label>
                        <input
                          type="text" name="ppc_reference_point"
                          defaultValue={ppcData?.ppc_reference_point || 'e.g. POI'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Reference voltage (kV)</label>
                        <input
                          type="text" name="ppc_reference_voltage_kv"
                          defaultValue={ppcData?.ppc_reference_voltage_kv || '220'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Voltage dead-band (%)</label>
                        <input
                          type="text" name="ppc_voltage_deadband_pct"
                          defaultValue={ppcData?.ppc_voltage_deadband_pct || '0.5'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Voltage droop (%)</label>
                        <input
                          type="text" name="ppc_voltage_droop_pct"
                          defaultValue={ppcData?.ppc_voltage_droop_pct || '4'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reactive power limits at POI */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Reactive power limits at POI</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Max injection (MVAr)</label>
                        <input
                          type="text" name="max_reactive_power_injection_mvar"
                          defaultValue={ppcData?.max_reactive_power_injection_mvar || '80'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Max absorption (MVAr)</label>
                        <input
                          type="text" name="max_reactive_power_absorption_mvar"
                          defaultValue={ppcData?.max_reactive_power_absorption_mvar || '80'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timing parameters */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Timing parameters</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">PPC communication time (ms)</label>
                        <input
                          type="number" name="ppc_comm_time_ms"
                          defaultValue={ppcData?.ppc_comm_time_ms || 100}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">PQ meter sampling time (ms)</label>
                        <input
                          type="number" name="ppc_sampling_time_ms"
                          defaultValue={ppcData?.ppc_sampling_time_ms || 20}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Total execution time (ms)</label>
                        <input
                          type="text" name="ppc_total_exec_time_ms"
                          defaultValue={ppcData?.ppc_total_exec_time_ms || '200'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Control Loop Parameters */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Control Loop Parameters</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Proportional Gain (Kp)</label>
                        <input
                          type="number" step="0.001" name="kp"
                          defaultValue={ppcData?.kp ?? ''}
                          placeholder="e.g. 1.50"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Integral Time Constant (Ti)</label>
                        <input
                          type="number" step="0.001" name="ti"
                          defaultValue={ppcData?.ti ?? ''}
                          placeholder="e.g. 0.05"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Frequency control */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Frequency control</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox" name="freq_control_mode_enabled" value="true"
                          defaultChecked={ppcData?.freq_control_mode === 'Enabled'}
                          className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                          id="freq-enabled-toggle"
                        />
                        <label htmlFor="freq-enabled-toggle" className="text-sm font-semibold text-slate-700">Frequency control mode enabled</label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Dead-band (Hz)</label>
                          <input
                            type="text" name="freq_deadband"
                            defaultValue={ppcData?.freq_deadband || '0.05'}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Droop (%)</label>
                          <input
                            type="text" name="freq_droop_pct"
                            defaultValue={ppcData?.freq_droop_pct || '5'}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox" name="power_reduction_at_50_3hz" value="true"
                          defaultChecked={ppcData?.power_reduction_at_50_3hz === 'Yes' || ppcData?.power_reduction_at_50_3hz === 'true'}
                          className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                          id="active-power-reduction-toggle"
                        />
                        <label htmlFor="active-power-reduction-toggle" className="text-sm font-semibold text-slate-700">Reduce active power by 10% if grid frequency reaches 50.3 Hz</label>
                      </div>
                    </div>
                  </div>

                  {/* Meta details */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Owner / Operator</label>
                        <input
                          type="text" name="owner"
                          defaultValue={ppcData?.owner || plant.owner || 'ACME Renewables'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Date setting was changed</label>
                        <input
                          type="date" name="date_changed" required
                          defaultValue={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">PPC Settings document upload</label>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3 mt-1">
                            <input
                              type="file"
                              accept=".xlsx,.pdf,.csv"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  try {
                                    showToast('Uploading file...', 'info');
                                    const res = await uploadAPI.uploadFile(file, 'ppc');
                                    setPpcUploadedFile(res.filename);
                                    showToast('File uploaded successfully.', 'success');
                                  } catch (err) {
                                    showToast('Failed to upload file.', 'error');
                                    console.error(err);
                                  }
                                }
                              }}
                              className="hidden" id="ppc-file-picker"
                            />
                            <label
                              htmlFor="ppc-file-picker"
                              className="px-4 py-2 border border-slate-250 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              ↑ Upload file
                            </label>
                            {ppcUploadedFile && (
                              <span className="text-xs text-slate-500 font-semibold truncate max-w-[120px]" title={ppcUploadedFile}>{ppcUploadedFile}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">Allowed formats: .xlsx, .pdf, .csv only</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm mt-4">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
                      <textarea
                        name="remarks"
                        defaultValue={ppcData?.remarks || ''}
                        placeholder="Add additional remarks or notes here..."
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Form Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => loadPlantData()}
                      className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm"
                    >
                      Cancel
                    </button>
                    {plant.can_write && (
                      <button
                        type="submit"
                        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all"
                      >
                        Save as new version
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}

            {/* PPC Audit History */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800">Version history</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase">
                      <th className="p-3">Date changed</th>
                      <th className="p-3">Changed by</th>
                      <th className="p-3">Mode of control</th>
                      <th className="p-3">File</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {!(ppcData?.history) || ppcData.history.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-400 font-medium">
                          No historic revisions logged.
                        </td>
                      </tr>
                    ) : (
                      ppcData.history.map((rev, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">{rev.date_changed}</td>
                          <td className="p-3 text-slate-500">{rev.changed_by}</td>
                          <td className="p-3 text-slate-500">{rev.ppc_mode_of_control || '—'}</td>
                          <td className="p-3 text-slate-500 font-mono text-xs">
                            {rev.file_name ? (
                              <a
                                href={`${BASE_URL}/api/upload/download/${rev.file_name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 font-bold hover:underline flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {rev.file_name.substring(0, 20) + (rev.file_name.length > 20 ? '...' : '')}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => setHistoryPreviewModal({ isOpen: true, type: 'ppc', data: rev })}
                              className="px-3 py-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition-all"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================= MODAL: EDIT POWER PLANT MASTER DETAILS ======================= */}
      {plantModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 animate-scale-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
              Edit Power Plant Master Profile
            </h3>
            {poolingStations.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-4xl">⚠️</span>
                <p className="mt-4 text-slate-700 font-bold">
                  No pooling stations are registered in the system.
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-6">
                  You must register a pooling station before you can update plant details.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlantModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePlant} className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Plant Name</label>
                    <input
                      type="text" name="name" required defaultValue={plant.name}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Location / Area</label>
                    <input
                      type="text" name="location" required defaultValue={plant.location}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pooling Station</label>
                    <select
                      name="pooling_station"
                      defaultValue={plant.pooling_station || ''}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                    >
                      <option value="">— Select Pooling Station —</option>
                      {poolingStations.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Rated Capacity (MW)</label>
                    <input
                      type="number" step="0.001" name="capacity_mw" required defaultValue={plant.capacity_mw}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Owner / Operator</label>
                    <input
                      type="text" name="owner" defaultValue={plant.owner || ''}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Company Group</label>
                    <input
                      type="text" name="company_group" defaultValue={plant.company_group || ''}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Connection Type</label>
                    <select
                      name="connection_type"
                      value={editConnectionType}
                      onChange={(e) => setEditConnectionType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                    >
                      <option value="">— Select Connection —</option>
                      <option value="ISTS CONNECTED">ISTS CONNECTED</option>
                      <option value="INTRA-STATE CONNECTED">INTRA-STATE CONNECTED</option>
                    </select>
                  </div>
                  {editConnectionType === 'ISTS CONNECTED' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Region</label>
                      <select
                        name="region"
                        value={editRegion}
                        onChange={(e) => setEditRegion(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
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
                  {editConnectionType === 'INTRA-STATE CONNECTED' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
                      <select
                        name="state"
                        value={editState}
                        onChange={(e) => setEditState(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
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
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Commissioned Date</label>
                    <input
                      type="date" name="commissioned_date"
                      defaultValue={plant.commissioned_date ? new Date(plant.commissioned_date).toISOString().split('T')[0] : ''}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                    />
                  </div>
                </div>

                {/* Extra master inputs mapping to ppc_plants backend columns */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">PPC & Connection Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">PPC OEM Name</label>
                      <input
                        type="text" name="ppc_oem" defaultValue={ppcData?.ppc_oem || 'ABB'}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Evacuating Line</label>
                      <input
                        type="text" name="evacuating_line" defaultValue={ppcData?.evacuating_line || ''}
                        placeholder="e.g. 400kV line"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">POI (Point of Interconnection)</label>
                      <input
                        type="text" name="poi" defaultValue={ppcData?.poi || ''}
                        placeholder="e.g. 400kV Bikaner(PG)"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-teal-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button" onClick={() => setPlantModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-50"
                  >
                    Save Master Info
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================= MODAL: VIEW HISTORIC AUDIT CONFIG SNAPSHOT ======================= */}
      {historyPreviewModal.isOpen && historyPreviewModal.data && (
        <div className="fixed inset-0 z-45 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Historic Configuration Snapshot
                </h3>
                <span className="text-xs text-slate-450 font-bold mt-1 block">
                  Changed on {historyPreviewModal.data.date_changed} by {historyPreviewModal.data.changed_by}
                </span>
              </div>
              <button
                onClick={() => setHistoryPreviewModal({ isOpen: false, type: '', data: null })}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg hover:bg-slate-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Inverter/WTG or SVG history preview */}
            {(historyPreviewModal.type === 'inverter' || historyPreviewModal.type === 'svg') && (
              <div className="space-y-6 text-sm text-slate-700">


                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LVRT */}
                  <div className="bg-blue-50/10 border border-blue-100 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-blue-750 uppercase tracking-widest mb-2 flex items-center gap-1">
                      Low Voltage Ride Through (LVRT)
                    </h4>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-xs">Trigger threshold</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.lvrt?.triggering_threshold_pu ?? '—'} pu</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-xs">UV stage 1</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.lvrt?.uv_stage1_voltage_pu ?? '—'} pu ({historyPreviewModal.data.lvrt?.uv_stage1_time_ms ?? '—'} ms)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-xs">UV stage 2</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.lvrt?.uv_stage2_voltage_pu ?? '—'} pu ({historyPreviewModal.data.lvrt?.uv_stage2_time_ms ?? '—'} ms)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-xs">UV stage 3</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.lvrt?.uv_stage3_voltage_pu ?? '—'} pu ({historyPreviewModal.data.lvrt?.uv_stage3_time_ms ?? '—'} ms)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400 text-xs">K-factor</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.lvrt?.k_factor ?? '—'}</span>
                    </div>
                  </div>

                  {/* HVRT */}
                  <div className="bg-rose-50/10 border border-rose-100 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-rose-750 uppercase tracking-widest mb-2 flex items-center gap-1">
                      High Voltage Ride Through (HVRT)
                    </h4>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-xs">Trigger threshold</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.hvrt?.triggering_threshold_pu ?? '—'} pu</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-xs">OV stage 1</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.hvrt?.ov_stage1_voltage_pu ?? '—'} pu ({historyPreviewModal.data.hvrt?.ov_stage1_time_ms ?? '—'} ms)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-xs">OV stage 2</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.hvrt?.ov_stage2_voltage_pu ?? '—'} pu ({historyPreviewModal.data.hvrt?.ov_stage2_time_ms ?? '—'} ms)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-xs">OV stage 3</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.hvrt?.ov_stage3_voltage_pu ?? '—'} pu ({historyPreviewModal.data.hvrt?.ov_stage3_time_ms ?? '—'} ms)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400 text-xs">K-factor</span>
                      <span className="font-bold text-slate-850">{historyPreviewModal.data.hvrt?.k_factor ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {historyPreviewModal.data.remarks && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks</span>
                    <p className="text-xs text-slate-700 font-semibold">{historyPreviewModal.data.remarks}</p>
                  </div>
                )}
              </div>
            )}

            {/* PPC settings history preview */}
            {historyPreviewModal.type === 'ppc' && (
              <div className="space-y-6 text-sm text-slate-700 font-sans">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    ['Mode of control', historyPreviewModal.data.ppc_mode_of_control],
                    ['Reference point', historyPreviewModal.data.ppc_reference_point],
                    ['Reference voltage', historyPreviewModal.data.ppc_reference_voltage_kv ? `${historyPreviewModal.data.ppc_reference_voltage_kv} kV` : '—'],
                    ['Voltage deadband', historyPreviewModal.data.ppc_voltage_deadband_pct],
                    ['Voltage droop', historyPreviewModal.data.ppc_voltage_droop_pct],
                    ['Max injection', historyPreviewModal.data.max_reactive_power_injection_mvar ? `${historyPreviewModal.data.max_reactive_power_injection_mvar} MVAr` : '—'],
                    ['Max absorption', historyPreviewModal.data.max_reactive_power_absorption_mvar ? `${historyPreviewModal.data.max_reactive_power_absorption_mvar} MVAr` : '—'],
                    ['Comm time', historyPreviewModal.data.ppc_comm_time_ms ? `${historyPreviewModal.data.ppc_comm_time_ms} ms` : '—'],
                    ['Sampling time', historyPreviewModal.data.ppc_sampling_time_ms ? `${historyPreviewModal.data.ppc_sampling_time_ms} ms` : '—'],
                    ['Total execution time', historyPreviewModal.data.ppc_total_exec_time_ms ? `${historyPreviewModal.data.ppc_total_exec_time_ms} ms` : '—'],
                    ['Proportional Gain (Kp)', historyPreviewModal.data.kp],
                    ['Integral Time Constant (Ti)', historyPreviewModal.data.ti],
                    ['Freq control mode', historyPreviewModal.data.freq_control_mode],
                    ['Freq deadband', historyPreviewModal.data.freq_deadband],
                    ['Freq droop', historyPreviewModal.data.freq_droop_pct],
                    ['Power reduction @50.3Hz', historyPreviewModal.data.power_reduction_at_50_3hz],
                    ['Owner / Operator', historyPreviewModal.data.owner],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lbl}</span>
                      <span className="font-semibold text-slate-700">{val || '—'}</span>
                    </div>
                  ))}
                </div>

                {historyPreviewModal.data.file_name && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 col-span-full">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Attached Document</span>
                    <a
                      href={`${BASE_URL}/api/upload/download/${historyPreviewModal.data.file_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 font-bold hover:underline flex items-center gap-1 w-fit"
                    >
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {historyPreviewModal.data.file_name}
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setHistoryPreviewModal({ isOpen: false, type: '', data: null })}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantDetail;
