import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import ConfirmDialog from '../components/ConfirmDialog';
import { plantsAPI, invertersAPI, usersAPI, permissionsAPI, poolingStationsAPI, ppcPlantsAPI, systemLogsAPI } from '../services/api';

// Reducer for session activity logging
const activityLogReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_LOG':
      const newLog = {
        id: Date.now(),
        message: action.payload.message,
        timestamp: new Date().toLocaleTimeString(),
      };
      return [newLog, ...state].slice(0, 20); // Keep last 20
    default:
      return state;
  }
};

const AdminDashboard = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab || 'overview';

  const { user } = useAuth();
  const { showToast } = useToast();

  // Core Data States
  const [plants, setPlants] = useState([]);
  const [inverters, setInverters] = useState([]);
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [poolingStations, setPoolingStations] = useState([]);
  
  // User creation permissions & role scope tracking states
  const [newUserPerms, setNewUserPerms] = useState([]);
  const [selectedRole, setSelectedRole] = useState('user');

  // Pooling Stations drill-down state
  const [selectedStation, setSelectedStation] = useState(null); // station detail panel
  const [stationPlants, setStationPlants] = useState([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [expandedPpcRow, setExpandedPpcRow] = useState(null);
  const [ppcModal, setPpcModal] = useState({ isOpen: false, type: 'add', data: null, stationId: null });
  const [stationModal, setStationModal] = useState({ isOpen: false, type: 'add', data: null });

  // Filter/Search/Paging States (for Inverters Tab)
  const [invPlantFilter, setInvPlantFilter] = useState('');
  const [invTypeFilter, setInvTypeFilter] = useState('All');
  const [invSearch, setInvSearch] = useState('');
  const [invSort, setInvSort] = useState('id');
  const [invOrder, setInvOrder] = useState('desc');
  const [invPage, setInvPage] = useState(1);
  const [invTotalPages, setInvTotalPages] = useState(1);
  const [invLimit] = useState(5); // 5 items per page for testing

  // UI state
  const [loading, setLoading] = useState(false);
  const [activityLogs, logDispatch] = useReducer(activityLogReducer, [
    { id: 1, message: 'Admin Dashboard loaded successfully.', timestamp: new Date().toLocaleTimeString() }
  ]);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
  const [isFreqPanelOpen, setIsFreqPanelOpen] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [freqInverters, setFreqInverters] = useState([]);
  const [overviewSubTab, setOverviewSubTab] = useState('plants');

  // Modals state
  const [plantModal, setPlantModal] = useState({ isOpen: false, type: 'add', data: null });
  const [inverterModal, setInverterModal] = useState({ isOpen: false, type: 'add', data: null });
  const [userModal, setUserModal] = useState({ isOpen: false, type: 'add', data: null });
  const [pwdModal, setPwdModal] = useState({ isOpen: false, userId: null });
  const [permPanel, setPermPanel] = useState({ isOpen: false, targetUser: null, userPerms: [], allPlants: [], allCompanyGroups: [], selectedCompanyGroup: '' });
  // Context set when plant/inverter modal is triggered from the permissions panel
  const [permPanelContext, setPermPanelContext] = useState(null); // { userId, username, companyGroup }

  // Delete Confirm Dialog state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, type: '', id: null, message: '' });

  // Tech details preview modal state (for row clicks)
  const [detailModal, setDetailModal] = useState({ isOpen: false, type: '', data: null });

  // Function to add activity log
  const logAction = useCallback((message) => {
    logDispatch({ type: 'ADD_LOG', payload: { message } });
  }, []);

  // Fetch core data based on active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [plantsData, invsData] = await Promise.all([
          plantsAPI.getAll(),
          invertersAPI.getAll({ limit: 1000 })
        ]);
        setPlants(plantsData.plants);
        setInverters(invsData.data);
      } else if (activeTab === 'plants') {
        const [plantsData, uData, invsData, psData] = await Promise.all([
          plantsAPI.getAll(),
          usersAPI.getAll().catch(() => ({ users: [] })),
          invertersAPI.getAll({ limit: 1000 }).catch(() => ({ data: [] })),
          poolingStationsAPI.getAll().catch(() => ({ poolingStations: [] }))
        ]);
        setPlants(plantsData.plants);
        setUsers(uData.users || []);
        setInverters(invsData.data || []);
        setPoolingStations(psData.poolingStations || []);
      } else if (activeTab === 'inverters') {
        const [data, pData, psData] = await Promise.all([
          invertersAPI.getAll({
            plant_id: invPlantFilter,
            type: invTypeFilter !== 'All' ? invTypeFilter : '',
            search: invSearch,
            sort: invSort,
            order: invOrder,
            page: invPage,
            limit: invLimit
          }),
          plantsAPI.getAll().catch(() => ({ plants: [] })),
          poolingStationsAPI.getAll().catch(() => ({ poolingStations: [] }))
        ]);
        setInverters(data.data);
        setInvTotalPages(data.totalPages);
        setPlants(pData.plants || []);
        setPoolingStations(psData.poolingStations || []);
      } else if (activeTab === 'users') {
        const [uData, pData, psData] = await Promise.all([
          usersAPI.getAll(),
          plantsAPI.getAll().catch(() => ({ plants: [] })),
          poolingStationsAPI.getAll().catch(() => ({ poolingStations: [] }))
        ]);
        setUsers(uData.users);
        setPlants(pData.plants || []);
        setPoolingStations(psData.poolingStations || []);
      } else if (activeTab === 'permissions') {
        const uData = await usersAPI.getAll();
        const pData = await plantsAPI.getAll();
        setUsers(uData.users);
        setPlants(pData.plants);
      } else if (activeTab === 'pooling-stations') {
        const [psData, plantsData] = await Promise.all([
          poolingStationsAPI.getAll(),
          plantsAPI.getAll().catch(() => ({ plants: [] }))
        ]);
        setPoolingStations(psData.poolingStations);
        setPlants(plantsData.plants || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Error loading page data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, invPlantFilter, invTypeFilter, invSearch, invSort, invOrder, invPage, invLimit, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch system logs on drawer open
  useEffect(() => {
    const fetchSystemLogs = async () => {
      try {
        const data = await systemLogsAPI.getAll();
        setSystemLogs(data.logs);
      } catch (err) {
        console.error('Failed to fetch system logs:', err);
      }
    };
    if (isLogDrawerOpen) {
      fetchSystemLogs();
    }
  }, [isLogDrawerOpen]);

  // Fetch all inverters for frequency control grouping on panel open
  useEffect(() => {
    const fetchFreqInverters = async () => {
      try {
        const res = await invertersAPI.getAll({ limit: 1000 });
        setFreqInverters(res.data);
      } catch (err) {
        console.error('Failed to fetch inverters for frequency control:', err);
      }
    };
    if (isFreqPanelOpen) {
      fetchFreqInverters();
    }
  }, [isFreqPanelOpen]);

  // Debounced search logic for Inverters
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'inverters') {
        setInvPage(1);
        fetchData();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [invSearch]);

  // --- Handlers for Plants ---
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
    };

    try {
      if (plantModal.type === 'add') {
        const createResult = await plantsAPI.create(plantData);
        showToast('Power plant created successfully.', 'success');
        logAction(`Created power plant "${plantData.name}".`);

        // If this was triggered from the permissions panel, auto-grant R+W and refresh panel
        if (permPanelContext && createResult.plant?.id) {
          const newPlantId = createResult.plant.id;
          const newPlantCompany = createResult.plant.company_group || '';
          await permissionsAPI.grant({ user_id: permPanelContext.userId, plant_id: newPlantId, can_read: true, can_write: true });
          // Refresh the permissions panel with updated plants
          const [allPlantsResult, userPermsResult] = await Promise.all([
            plantsAPI.getAll(),
            permissionsAPI.getByUserId(permPanelContext.userId)
          ]);
          const updatedAllPlants = allPlantsResult.plants;
          const updatedPerms = userPermsResult.permissions;
          const targetGroup = permPanelContext.companyGroup || newPlantCompany;
          const filteredPlants = updatedAllPlants.filter(p => p.company_group === targetGroup);
          const updatedMap = filteredPlants.map(p => {
            const matchingPerm = updatedPerms.find(up => up.plant_id === p.id);
            return {
              plantId: p.id,
              plantName: p.name,
              companyGroup: p.company_group,
              canRead: matchingPerm ? matchingPerm.can_read : false,
              canWrite: matchingPerm ? matchingPerm.can_write : false,
            };
          });
          setPermPanel(prev => ({
            ...prev,
            allPlants: updatedAllPlants,
            userPerms: updatedMap,
            selectedCompanyGroup: targetGroup,
          }));
          setPermPanelContext(null);
        }
      } else {
        await plantsAPI.update(plantModal.data.id, plantData);
        showToast('Power plant updated successfully.', 'success');
        logAction(`Updated power plant "${plantData.name}".`);
      }
      setPlantModal({ isOpen: false, type: 'add', data: null });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save power plant.', 'error');
    }
  };

  const handleOpenDeletePlant = (plant) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'plant',
      id: plant.id,
      message: `Are you sure you want to delete power plant "${plant.name}"? All associated inverters and permissions will be permanently removed. This action is irreversible.`
    });
  };

  // --- Handlers for Inverters ---
  const handleSaveInverter = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const count = parseInt(formData.get('count'), 10);
    const capacity_mw = parseFloat(formData.get('capacity_mw'));
    const total_capacity_mw = parseFloat(formData.get('total_capacity_mw')) || (count * capacity_mw);

    const invData = {
      plant_id: parseInt(formData.get('plant_id'), 10),
      make: formData.get('make'),
      model: formData.get('model'),
      type: formData.get('type'),
      rating_mva: parseFloat(formData.get('rating_mva')) || null,
      capacity_mw: capacity_mw,
      count: count,
      total_capacity_mw: total_capacity_mw,
      pooling_station: formData.get('pooling_station') || null,
      owner: formData.get('owner') || null,
      efficiency_percent: inverterModal.type === 'edit' ? inverterModal.data.efficiency_percent : null,
      last_maintenance_date: formData.get('last_maintenance_date') || null,
    };

    try {
      if (inverterModal.type === 'add') {
        await invertersAPI.create(invData);
        showToast('Inverter group registered successfully.', 'success');
        logAction(`Registered inverter group "${invData.make} ${invData.model}".`);
      } else {
        await invertersAPI.update(inverterModal.data.id, invData);
        showToast('Inverter group updated successfully.', 'success');
        logAction(`Updated inverter group "${invData.make} ${invData.model}".`);
      }
      setInverterModal({ isOpen: false, type: 'add', data: null });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save inverter.', 'error');
    }
  };

  const handleOpenDeleteInverter = (inv) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'inverter',
      id: inv.id,
      message: `Are you sure you want to delete inverter group "${inv.make} ${inv.model}"?`
    });
  };

  const handleExportCSV = async () => {
    try {
      const blob = await invertersAPI.exportCSV({
        plant_id: invPlantFilter,
        type: invTypeFilter !== 'All' ? invTypeFilter : '',
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inverters_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      logAction('Exported inverters grid data as CSV.');
      showToast('CSV report downloaded.', 'success');
    } catch (err) {
      showToast('Failed to export CSV report.', 'error');
    }
  };

  // --- Handlers for Users & Permissions ---
  const handleOpenAddUserModal = async () => {
    setSelectedRole('user');
    // Ensure plants are loaded (may not be if coming directly to users tab)
    let plantsList = plants;
    if (!plantsList || plantsList.length === 0) {
      try {
        const pData = await plantsAPI.getAll();
        plantsList = pData.plants || [];
        setPlants(plantsList);
      } catch (err) {
        plantsList = [];
      }
    }
    setNewUserPerms(
      plantsList.map(p => ({
        plantId: p.id,
        plantName: p.name,
        canRead: false,
        canWrite: false
      }))
    );
    setUserModal({ isOpen: true, type: 'add', data: null });
  };

  const handleOpenEditUserModal = (u) => {
    setSelectedRole(u.role);
    setUserModal({ isOpen: true, type: 'edit', data: u });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const uData = {
      username: formData.get('username'),
      email: formData.get('email'),
      role: formData.get('role'),
    };

    if (userModal.type === 'add') {
      uData.password = formData.get('password');
    }

    try {
      if (userModal.type === 'add') {
        const createResult = await usersAPI.create(uData);
        const newUser = createResult.user;

        // Save initial plant permissions batch for Operators
        if (uData.role === 'user' && newUserPerms.length > 0) {
          const activePerms = newUserPerms.filter(p => p.canRead || p.canWrite);
          if (activePerms.length > 0) {
            await permissionsAPI.saveBatch(newUser.id, activePerms);
            logAction(`Batch-assigned initial plant permissions for user "${uData.username}".`);
          }
        }

        showToast('User account created successfully.', 'success');
        logAction(`Created user account "${uData.username}".`);
      } else {
        await usersAPI.update(userModal.data.id, uData);
        showToast('User details updated successfully.', 'success');
        logAction(`Updated user account "${uData.username}".`);
      }
      setUserModal({ isOpen: false, type: 'add', data: null });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save user account.', 'error');
    }
  };

  const handleSaveStation = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const stationData = {
      name: formData.get('name'),
      total_capacity_mw: formData.get('total_capacity_mw') ? parseFloat(formData.get('total_capacity_mw')) : null,
    };

    try {
      if (stationModal.type === 'add') {
        await poolingStationsAPI.create(stationData);
        showToast('Pooling station created successfully.', 'success');
        logAction(`Created pooling station "${stationData.name}".`);
      } else {
        await poolingStationsAPI.update(stationModal.data.id, stationData);
        showToast('Pooling station updated successfully.', 'success');
        logAction(`Updated pooling station "${stationData.name}".`);
      }
      setStationModal({ isOpen: false, type: 'add', data: null });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save pooling station.', 'error');
    }
  };

  const handleSavePpcPlant = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const ppcData = {
      pooling_station_id: ppcModal.stationId,
      power_plant_id: formData.get('power_plant_id') ? parseInt(formData.get('power_plant_id'), 10) : null,
      plant_name: formData.get('plant_name'),
      wbes_acronym: formData.get('wbes_acronym') || null,
      capacity_mw: formData.get('capacity_mw') ? parseFloat(formData.get('capacity_mw')) : null,
      evacuating_line: formData.get('evacuating_line') || null,
      poi: formData.get('poi') || null,
      owner: formData.get('owner') || null,
      ppc_oem: formData.get('ppc_oem') || null,
      ppc_mode_of_control: formData.get('ppc_mode_of_control') || null,
      ppc_reference_point: formData.get('ppc_reference_point') || null,
      ppc_reference_voltage_kv: formData.get('ppc_reference_voltage_kv') ? parseFloat(formData.get('ppc_reference_voltage_kv')) : null,
      ppc_voltage_deadband_pct: formData.get('ppc_voltage_deadband_pct') ? parseFloat(formData.get('ppc_voltage_deadband_pct')) : null,
      ppc_voltage_droop_pct: formData.get('ppc_voltage_droop_pct') ? parseFloat(formData.get('ppc_voltage_droop_pct')) : null,
      max_reactive_power_injection_mvar: formData.get('max_reactive_power_injection_mvar') ? parseFloat(formData.get('max_reactive_power_injection_mvar')) : null,
      max_reactive_power_absorption_mvar: formData.get('max_reactive_power_absorption_mvar') ? parseFloat(formData.get('max_reactive_power_absorption_mvar')) : null,
      ppc_comm_time_ms: formData.get('ppc_comm_time_ms') ? parseFloat(formData.get('ppc_comm_time_ms')) : null,
      ppc_sampling_time_ms: formData.get('ppc_sampling_time_ms') ? parseFloat(formData.get('ppc_sampling_time_ms')) : null,
      ppc_total_exec_time_ms: formData.get('ppc_total_exec_time_ms') ? parseFloat(formData.get('ppc_total_exec_time_ms')) : null,
      freq_control_mode: formData.get('freq_control_mode') || null,
      freq_deadband: formData.get('freq_deadband') ? parseFloat(formData.get('freq_deadband')) : null,
      freq_droop_pct: formData.get('freq_droop_pct') ? parseFloat(formData.get('freq_droop_pct')) : null,
      power_reduction_at_50_3hz: formData.get('power_reduction_at_50_3hz') || null,
    };

    try {
      if (ppcModal.type === 'add') {
        await ppcPlantsAPI.create(ppcData);
        showToast('RE Plant added successfully.', 'success');
        logAction(`Added RE plant "${ppcData.plant_name}" to station ID ${ppcModal.stationId}.`);
      } else {
        await ppcPlantsAPI.update(ppcModal.data.id, ppcData);
        showToast('RE Plant updated successfully.', 'success');
        logAction(`Updated RE plant "${ppcData.plant_name}".`);
      }
      setPpcModal({ isOpen: false, type: 'add', data: null, stationId: null });
      // Refresh the station drill-down plants list
      if (selectedStation) {
        const d = await poolingStationsAPI.getById(selectedStation.id);
        setStationPlants(d.plants);
      }
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save RE plant.', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const password = formData.get('password');

    try {
      await usersAPI.resetPassword(pwdModal.userId, password);
      showToast('Password reset successfully.', 'success');
      logAction(`Reset password for user ID ${pwdModal.userId}.`);
      setPwdModal({ isOpen: false, userId: null });
    } catch (err) {
      showToast('Failed to reset password.', 'error');
    }
  };

  const handleOpenDeleteUser = (u) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'user',
      id: u.id,
      message: `Are you sure you want to delete user account "${u.username}"? Their plant permissions overrides will be revoked.`
    });
  };

  const handleOpenPermissionsPanel = async (u) => {
    try {
      const [allPlantsResult, userPermsResult] = await Promise.all([
        plantsAPI.getAll(),
        permissionsAPI.getByUserId(u.id)
      ]);

      const plantsList = allPlantsResult.plants;
      const uPerms = userPermsResult.permissions;

      // Collect all unique company groups from all plants
      const allCompanyGroups = [...new Set(
        plantsList
          .map(p => p.company_group)
          .filter(g => g && g.trim() !== '')
      )].sort();

      // Detect user's company ONLY from their existing plant permissions.
      // New users with no permissions get no company label — admin adds plants fresh.
      let detectedCompany = '';
      if (uPerms.length > 0) {
        const firstPermPlantId = uPerms[0].plant_id;
        const matchedPlant = plantsList.find(p => p.id === firstPermPlantId);
        detectedCompany = matchedPlant?.company_group || '';
      }

      // Fallback to first company group if new user has no company permissions yet
      const activeGroup = detectedCompany || (allCompanyGroups.length > 0 ? allCompanyGroups[0] : '');

      // Filter plants to only that company group (empty string → no plants shown)
      const filteredPlants = activeGroup
        ? plantsList.filter(p => p.company_group === activeGroup)
        : [];

      // Build permission map for only the filtered plants
      const initialMap = filteredPlants.map(p => {
        const matchingPerm = uPerms.find(up => up.plant_id === p.id);
        return {
          plantId: p.id,
          plantName: p.name,
          companyGroup: p.company_group,
          canRead: matchingPerm ? matchingPerm.can_read : false,
          canWrite: matchingPerm ? matchingPerm.can_write : false,
        };
      });

      setPermPanel({
        isOpen: true,
        targetUser: u,
        userPerms: initialMap,
        rawUserPerms: uPerms,
        allPlants: plantsList,
        allCompanyGroups,
        selectedCompanyGroup: activeGroup,
      });
    } catch (err) {
      showToast('Error loading user permissions.', 'error');
    }
  };

  // When admin changes the company group selector in the permissions panel
  const handleChangePermCompany = (newGroup) => {
    setPermPanel(prev => {
      const filteredPlants = prev.allPlants.filter(p => p.company_group === newGroup);
      const newPerms = filteredPlants.map(p => {
        const matchingRaw = prev.rawUserPerms?.find(up => up.plant_id === p.id);
        if (matchingRaw) {
          return {
            plantId: p.id,
            plantName: p.name,
            companyGroup: p.company_group,
            canRead: matchingRaw.can_read,
            canWrite: matchingRaw.can_write,
          };
        }
        const existing = prev.userPerms.find(up => up.plantId === p.id);
        return {
          plantId: p.id,
          plantName: p.name,
          companyGroup: p.company_group,
          canRead: existing ? existing.canRead : false,
          canWrite: existing ? existing.canWrite : false,
        };
      });
      return { ...prev, selectedCompanyGroup: newGroup, userPerms: newPerms };
    });
  };

  const handleTogglePermCheckbox = (plantId, field) => {
    setPermPanel((prev) => {
      const updatedPerms = prev.userPerms.map(up => {
        if (up.plantId === plantId) {
          const updatedVal = !up[field];
          const updatedObj = { ...up, [field]: updatedVal };
          if (field === 'canWrite' && updatedVal) {
            updatedObj.canRead = true;
          }
          if (field === 'canRead' && !updatedVal) {
            updatedObj.canWrite = false;
          }
          return updatedObj;
        }
        return up;
      });

      const updatedRawPerms = [...(prev.rawUserPerms || [])];
      const matchIdx = updatedRawPerms.findIndex(rp => rp.plant_id === plantId);
      const matching = updatedPerms.find(up => up.plantId === plantId);
      
      if (matchIdx > -1) {
        updatedRawPerms[matchIdx] = {
          ...updatedRawPerms[matchIdx],
          can_read: matching.canRead,
          can_write: matching.canWrite,
        };
      } else {
        updatedRawPerms.push({
          plant_id: plantId,
          can_read: matching.canRead,
          can_write: matching.canWrite,
        });
      }

      return { ...prev, userPerms: updatedPerms, rawUserPerms: updatedRawPerms };
    });
  };

  const handleSaveBatchPermissions = async () => {
    try {
      await permissionsAPI.saveBatch(permPanel.targetUser.id, permPanel.userPerms);
      showToast('User permissions batch-saved successfully.', 'success');
      logAction(`Batch-updated plant permissions for user "${permPanel.targetUser.username}".`);
      setPermPanel({ isOpen: false, targetUser: null, userPerms: [] });
      fetchData();
    } catch (err) {
      showToast('Failed to save permissions batch.', 'error');
    }
  };

  // --- Confirm Dialog Execution ---
  const handleConfirmDelete = async () => {
    const { type, id } = deleteConfirm;
    try {
      if (type === 'plant') {
        await plantsAPI.delete(id);
        showToast('Power plant deleted.', 'success');
        logAction(`Deleted power plant ID ${id}.`);
      } else if (type === 'inverter') {
        await invertersAPI.delete(id);
        showToast('Inverter deleted.', 'success');
        logAction(`Deleted inverter ID ${id}.`);
      } else if (type === 'user') {
        await usersAPI.delete(id);
        showToast('User account deleted.', 'success');
        logAction(`Deleted user ID ${id}.`);
      } else if (type === 'pooling-station') {
        await poolingStationsAPI.delete(id);
        showToast('Pooling station deleted.', 'success');
        logAction(`Deleted pooling station ID ${id}.`);
      } else if (type === 'ppc-plant') {
        await ppcPlantsAPI.delete(id);
        showToast('RE plant deleted.', 'success');
        logAction(`Deleted RE plant ID ${id}.`);
        // Refresh the drill-down panel
        if (selectedStation) {
          const d = await poolingStationsAPI.getById(selectedStation.id);
          setStationPlants(d.plants);
        }
      }
      setDeleteConfirm({ isOpen: false, type: '', id: null, message: '' });
      fetchData();
    } catch (err) {
      showToast('Failed to delete resource.', 'error');
    }
  };

  // Sort helper
  const handleSort = (field) => {
    const isAsc = invSort === field && invOrder === 'asc';
    setInvSort(field);
    setInvOrder(isAsc ? 'desc' : 'asc');
    setInvPage(1);
  };

  const getCompanyInsights = () => {
    const companies = {};

    plants.forEach(p => {
      const group = p.company_group || 'Unknown';
      if (!companies[group]) {
        companies[group] = {
          name: group,
          plantCount: 0,
          capacity_mw: 0,
          inverter_count: 0,
          svg_makes_set: new Set(),
        };
      }
      companies[group].plantCount += 1;
      companies[group].capacity_mw += parseFloat(p.capacity_mw || '0');
      companies[group].inverter_count += parseInt(p.inverter_count || '0', 10);

      if (p.svg_makes && p.svg_makes !== '—' && p.svg_makes !== '') {
        p.svg_makes.split(', ').forEach(make => {
          if (make && make !== '—') {
            companies[group].svg_makes_set.add(make);
          }
        });
      }
    });

    return Object.values(companies)
      .map(c => ({
        ...c,
        svg_makes: c.svg_makes_set.size > 0 ? Array.from(c.svg_makes_set).join(', ') : '—'
      }))
      .sort((a, b) => b.capacity_mw - a.capacity_mw);
  };

  const getInverterMakesData = () => {
    const makes = {};
    let totalNonSvg = 0;
    inverters.forEach(i => {
      if (i.type === 'SVG') return;
      const make = i.make || 'Unknown';
      const count = parseInt(i.count, 10) || 0;
      if (!makes[make]) {
        makes[make] = 0;
      }
      makes[make] += count;
      totalNonSvg += count;
    });

    return Object.entries(makes).map(([name, count]) => ({
      name,
      count,
      percentage: totalNonSvg > 0 ? ((count / totalNonSvg) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.count - a.count);
  };

  const getGroupedFreqInverters = () => {
    const groups = {
      'ROCOF': [],
      'df/dt': [],
      'None': []
    };

    freqInverters.forEach(i => {
      if (i.type === 'SVG') return;
      const mode = (i.freq_control_mode || '').trim();
      if (mode.toLowerCase() === 'rocof') {
        groups['ROCOF'].push(i);
      } else if (mode.toLowerCase() === 'df/dt' || mode.toLowerCase() === 'df/dt mode') {
        groups['df/dt'].push(i);
      } else {
        groups['None'].push(i);
      }
    });

    return groups;
  };

  // --- Calculations for Overview Chart & Cards ---
  const totalPlants = plants.length;
  const totalInverters = inverters.reduce((acc, curr) => acc + (parseInt(curr.count, 10) || 0), 0);
  const totalCentralInverters = inverters.filter(i => i.type === 'Central').reduce((acc, curr) => acc + (parseInt(curr.count, 10) || 0), 0);
  const totalStringInverters = inverters.filter(i => i.type === 'String').reduce((acc, curr) => acc + (parseInt(curr.count, 10) || 0), 0);
  const totalWTGs = inverters.filter(i => i.type === 'WTG').reduce((acc, curr) => acc + (parseInt(curr.count, 10) || 0), 0);
  const totalBESS = inverters.filter(i => i.type === 'BESS').reduce((acc, curr) => acc + (parseInt(curr.count, 10) || 0), 0);
  const totalSVGs = inverters.filter(i => i.type === 'SVG').reduce((acc, curr) => acc + (parseInt(curr.count, 10) || 0), 0);
  const totalCapacityMW = plants.reduce((acc, p) => acc + parseFloat(p.capacity_mw || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* Main Admin Dashboard Wrapper */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col justify-between border-r border-slate-800">
          <div className="p-4">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Admin Console
            </div>
            <nav className="mt-4 space-y-1">
              <button
                onClick={() => navigate('/admin/dashboard/overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 ${
                  activeTab === 'overview'
                    ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20'
                    : 'hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                </svg>
                Overview
              </button>

              <button
                onClick={() => navigate('/admin/dashboard/plants')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 ${
                  activeTab === 'plants'
                    ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20'
                    : 'hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Power Plants
              </button>

              <button
                onClick={() => navigate('/admin/dashboard/inverters')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 ${
                  activeTab === 'inverters'
                    ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20'
                    : 'hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Inverters Grid
              </button>

              <button
                onClick={() => navigate('/admin/dashboard/pooling-stations')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 ${
                  activeTab === 'pooling-stations'
                    ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20'
                    : 'hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Pooling Stations
              </button>

              <button
                onClick={() => navigate('/admin/dashboard/users')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 ${
                  activeTab === 'users'
                    ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20'
                    : 'hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Profiles
              </button>

              <button
                onClick={() => navigate('/admin/dashboard/permissions')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 ${
                  activeTab === 'permissions'
                    ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20'
                    : 'hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m-2 4a2 2 0 012 2m-8-3a3 3 0 11-6 0 3 3 0 016 0zm6.3 8.5a6 6 0 01-12.6 0" />
                </svg>
                Access Permissions
              </button>

              <button
                onClick={() => setIsFreqPanelOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all-300 hover:bg-slate-800/80 hover:text-white"
              >
                <svg className="w-5 h-5 text-slate-450" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Frequency Control
              </button>
            </nav>
          </div>

          {/* Activity Drawer Toggle */}
          <div className="p-4 border-t border-slate-850">
            <button
              onClick={() => setIsLogDrawerOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all-300 border border-slate-700"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View System Logs
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {loading && (
            <div className="mb-4 text-sm font-semibold text-teal-600 bg-teal-50 border border-teal-100 p-3 rounded-xl flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Updating workspace database...</span>
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Headline */}
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Overview of ISTS connected Solar/WTG/BESS/Hybrid Plants</h2>
                <p className="text-sm text-slate-500 font-medium">Real-time status summaries of connected grids</p>
              </div>

              {/* Stats Card Grid — Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Plants</div>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{totalPlants}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Inverters</div>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{totalInverters}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Capacity (MW)</div>
                  <div className="text-3xl font-extrabold text-teal-600 mt-2">{totalCapacityMW.toFixed(2)}</div>
                </div>
              </div>

              {/* Stats Card Grid — Row 2: Device Type Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Central Inverters</div>
                  <div className="text-2xl font-extrabold text-slate-800 mt-2">{totalCentralInverters}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">String Inverters</div>
                  <div className="text-2xl font-extrabold text-slate-800 mt-2">{totalStringInverters}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total WTGs</div>
                  <div className="text-2xl font-extrabold text-blue-600 mt-2">{totalWTGs}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total BESS</div>
                  <div className="text-2xl font-extrabold text-amber-600 mt-2">{totalBESS}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total SVGs</div>
                  <div className="text-2xl font-extrabold text-violet-600 mt-2">{totalSVGs}</div>
                </div>
              </div>

              {/* Custom SVG Inverter Make Bar Chart */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-4">Total Inverters by Inverter Make</h3>
                {inverters.filter(i => i.type !== 'SVG').length === 0 ? (
                  <div className="text-sm text-slate-400 py-10 text-center">No inverter makes mapped to show graph analytics.</div>
                ) : (
                  <div className="relative w-full overflow-x-auto">
                    {(() => {
                      const makesData = getInverterMakesData();
                      const maxCount = Math.max(...makesData.map(m => m.count), 1);
                      const midCount = Math.round(maxCount / 2);
                      return (
                        <svg viewBox="0 0 950 300" className="w-full min-w-[850px] h-64">
                          {/* Grid lines */}
                          <line x1="50" y1="70" x2="900" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                          <line x1="50" y1="160" x2="900" y2="160" stroke="#f1f5f9" strokeWidth="1" />
                          <line x1="50" y1="250" x2="900" y2="250" stroke="#cbd5e1" strokeWidth="1.5" />

                          {/* Y-Axis Label */}
                          <text x="15" y="75" fill="#94a3b8" fontSize="10" fontWeight="bold">{maxCount}</text>
                          <text x="15" y="165" fill="#94a3b8" fontSize="10" fontWeight="bold">{midCount}</text>
                          <text x="15" y="255" fill="#94a3b8" fontSize="10" fontWeight="bold">0</text>

                          {/* Render Bars */}
                          {makesData.map((m, idx) => {
                            const barWidth = 45;
                            const spacing = Math.min(110, 820 / makesData.length);
                            const x = 70 + idx * spacing;
                            
                            // Scale height: max bar height is 180px
                            const h = (m.count / maxCount) * 180;
                            const y = 250 - h;

                            // Color palettes - alternate between beautiful vibrant colors
                            const colors = ['#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4'];
                            const color = colors[idx % colors.length];

                            return (
                              <g key={m.name}>
                                {/* Bar with rounded top corners */}
                                <rect
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={h}
                                  fill={color}
                                  rx="4"
                                />

                                {/* Count text */}
                                <text
                                  x={x + barWidth / 2}
                                  y={y - 8}
                                  fill="#475569"
                                  fontSize="10"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {m.count} ({m.percentage}%)
                                </text>

                                {/* X-Axis Label */}
                                <text
                                  x={x + barWidth / 2}
                                  y="270"
                                  fill="#64748b"
                                  fontSize="9"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {m.name}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Tabs for Insights Selection */}
              <div className="flex gap-2 p-1 bg-slate-200/60 border border-slate-300/30 rounded-xl w-fit">
                <button
                  onClick={() => setOverviewSubTab('plants')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                    overviewSubTab === 'plants'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Plant-level Insights
                </button>
                <button
                  onClick={() => setOverviewSubTab('companies')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                    overviewSubTab === 'companies'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Company-level Insights
                </button>
              </div>

              {/* TABLE: PLANT INSIGHTS */}
              {overviewSubTab === 'plants' && (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-hidden space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Operational Insights by Power Plant</h3>
                    <p className="text-xs text-slate-400 font-semibold">Granular breakdown of operational status and capacities per plant</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 text-xs text-slate-450 font-bold uppercase">
                          <th className="pb-3">Plant Name</th>
                          <th className="pb-3">Company Group</th>
                          <th className="pb-3">Location</th>
                          <th className="pb-3">Capacity (MW)</th>
                          <th className="pb-3 text-center">Total Inverters</th>
                          <th className="pb-3 text-center">Total Inverter Capacity (MW)</th>
                          <th className="pb-3">Inverter Make</th>
                          <th className="pb-3">PPC OEM</th>
                          <th className="pb-3">SVG Make</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {plants.map((p) => {
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="py-3 font-semibold text-slate-800">{p.name}</td>
                              <td className="py-3 text-slate-600 font-medium">{p.company_group || 'N/A'}</td>
                              <td className="py-3 text-slate-500">{p.location}</td>
                              <td className="py-3 font-bold text-slate-700">{Number(p.capacity_mw).toFixed(2)} MW</td>
                              <td className="py-3 font-bold text-slate-700 text-center">{p.inverter_count}</td>
                              <td className="py-3 font-bold text-slate-700 text-center">{Number(p.total_inverter_capacity).toFixed(2)} MW</td>
                              <td className="py-3 text-slate-600 font-medium">{p.inverter_makes || '—'}</td>
                              <td className="py-3 text-slate-600 font-medium">{p.ppc_oem || '—'}</td>
                              <td className="py-3 text-slate-600 font-medium">{p.svg_makes || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TABLE: COMPANY INSIGHTS */}
              {overviewSubTab === 'companies' && (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-hidden space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Operational Insights by Company Group</h3>
                    <p className="text-xs text-slate-400 font-semibold">Aggregated metrics, capacities, and SVG makes across all companies</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 text-xs text-slate-450 font-bold uppercase">
                          <th className="pb-3">Company Group Name</th>
                          <th className="pb-3 text-center">Power Plants</th>
                          <th className="pb-3">Total Capacity (MW)</th>
                          <th className="pb-3 text-center">Total Inverters</th>
                          <th className="pb-3">SVG Make</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {getCompanyInsights().map((c) => (
                          <tr key={c.name} className="hover:bg-slate-50/50">
                            <td className="py-3 font-semibold text-slate-800">{c.name}</td>
                            <td className="py-3 text-slate-700 font-bold text-center">{c.plantCount}</td>
                            <td className="py-3 font-extrabold text-teal-600">{Number(c.capacity_mw).toFixed(2)} MW</td>
                            <td className="py-3 font-bold text-slate-700 text-center">{c.inverter_count}</td>
                            <td className="py-3 text-slate-600 font-medium">{c.svg_makes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}          {/* TAB: POWER PLANTS */}
          {activeTab === 'plants' && (
            <div className="space-y-6">
              {/* Header section matching Screen 1 */}
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Admin dashboard</h2>
                <p className="text-sm text-slate-500 font-medium">RE Plant Controls & Protection Settings Database Portal — Screen 1 of 4</p>
              </div>

              {/* KPI Cards matching Screen 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-[#f7f5f0] border border-slate-150 rounded-2xl p-6 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total plants</div>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{plants.length || 0}</div>
                </div>
                <div className="bg-[#f7f5f0] border border-slate-150 rounded-2xl p-6 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total users</div>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{users.length || 0}</div>
                </div>
                <div className="bg-[#f7f5f0] border border-slate-150 rounded-2xl p-6 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inverter records</div>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">
                    {inverters.reduce((acc, curr) => acc + (parseInt(curr.count, 10) || 0), 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Plants Table Header with Actions */}
              <div className="flex items-center justify-between mt-8">
                <h3 className="text-lg font-bold text-slate-800">Plants</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlantModal({ isOpen: true, type: 'add', data: null })}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition-all duration-300"
                  >
                    + Add plant
                  </button>
                  <button
                    onClick={handleOpenAddUserModal}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition-all duration-300"
                  >
                    + Add user
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase">
                        <th className="p-4">RE plant name</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Pooling station</th>
                        <th className="p-4">Capacity (MW)</th>
                        <th className="p-4">PPC OEM</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {plants.map((p) => {
                        // Dynamically map type
                        const nameLower = p.name.toLowerCase();
                        let type = 'Solar';
                        if (nameLower.includes('wind')) type = 'Wind';
                        else if (nameLower.includes('bess') || nameLower.includes('battery') || nameLower.includes('storage')) type = 'BESS';
                        else if (nameLower.includes('hybrid')) type = 'Hybrid';

                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-slate-50/50 cursor-pointer"
                            onClick={() => setDetailModal({ isOpen: true, type: 'plant', data: p })}
                          >
                            <td className="p-4 font-semibold text-slate-800">{p.name}</td>
                            <td className="p-4 text-slate-500">{type}</td>
                            <td className="p-4 text-slate-550 font-medium">{p.pooling_station || '—'}</td>
                            <td className="p-4 font-bold text-slate-700">{Math.round(p.capacity_mw)} MW</td>
                            <td className="p-4 text-slate-500 font-medium">{p.ppc_oem || '—'}</td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-2 items-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/plant/${p.id}`);
                                  }}
                                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all duration-300"
                                >
                                  Open
                                </button>
                                <button
                                  onClick={() => setPlantModal({ isOpen: true, type: 'edit', data: p })}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                  title="Edit plant"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleOpenDeletePlant(p)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Delete plant"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: POOLING STATIONS */}
          {activeTab === 'pooling-stations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Pooling Stations</h2>
                  <p className="text-sm text-slate-500 font-medium">220kV/400kV grid substations with RE plant registry</p>
                </div>
                <button
                  onClick={() => setStationModal({ isOpen: true, type: 'add', data: null })}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm transition-all-300"
                >
                  Add Station
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Stations</div>
                  <div className="text-3xl font-extrabold text-slate-800 mt-2">{poolingStations.length}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total RE Plants</div>
                  <div className="text-3xl font-extrabold text-teal-700 mt-2">{poolingStations.reduce((a, s) => a + (s.plant_count || 0), 0)}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Capacity</div>
                  <div className="text-3xl font-extrabold text-emerald-700 mt-2">{poolingStations.reduce((a, s) => a + parseFloat(s.actual_capacity_mw || 0), 0).toFixed(0)} MW</div>
                </div>
              </div>

              {/* Station Table */}
              {!selectedStation ? (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase">
                          <th className="p-4">Station Name</th>
                          <th className="p-4 text-center">No. of RE Plants</th>
                          <th className="p-4">Total Capacity (MW)</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {poolingStations.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-10 text-slate-400 font-medium">No pooling stations found. Run <code className="bg-slate-100 px-1 rounded text-xs">node ppcSeed.js</code> to seed data.</td></tr>
                        ) : poolingStations.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="p-4">
                              <button
                                onClick={async () => {
                                  setStationLoading(true);
                                  try {
                                    const d = await poolingStationsAPI.getById(s.id);
                                    setSelectedStation(d.station);
                                    setStationPlants(d.plants);
                                  } catch { showToast('Failed to load station detail.', 'error'); }
                                  finally { setStationLoading(false); }
                                }}
                                className="font-bold text-teal-700 hover:text-teal-800 hover:underline text-left"
                              >
                                {s.name}
                              </button>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-700">{s.plant_count}</td>
                            <td className="p-4 font-bold text-emerald-700">{parseFloat(s.actual_capacity_mw || 0).toFixed(2)} MW</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    setStationLoading(true);
                                    try {
                                      const d = await poolingStationsAPI.getById(s.id);
                                      setSelectedStation(d.station);
                                      setStationPlants(d.plants);
                                    } catch { showToast('Failed to load station.', 'error'); }
                                    finally { setStationLoading(false); }
                                  }}
                                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold rounded-lg text-xs transition-all"
                                  title="View plants"
                                >View Plants</button>
                                <button
                                  onClick={() => navigate(`/station-dashboard/${s.id}`)}
                                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded-lg text-xs transition-all"
                                  title="Preview station dashboard"
                                >Preview</button>
                                <button
                                  onClick={() => setStationModal({ isOpen: true, type: 'edit', data: s })}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all-300"
                                  title="Edit Station"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteConfirm({
                                      isOpen: true,
                                      type: 'pooling-station',
                                      id: s.id,
                                      message: `Delete pooling station "${s.name}"? All RE plants under it will also be removed.`
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all-300"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Drill-down panel */
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setSelectedStation(null); setStationPlants([]); setExpandedPpcRow(null); }}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Stations
                    </button>
                    <span className="text-slate-300">|</span>
                    <h3 className="text-lg font-bold text-slate-800">{selectedStation.name}</h3>
                    <span className="text-sm text-slate-400 font-medium">· {stationPlants.length} plants · {stationPlants.reduce((a, p) => a + parseFloat(p.capacity_mw || 0), 0).toFixed(2)} MW</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-medium">Click any row to expand full RE Plant detail</p>
                    <button
                      onClick={() => setPpcModal({ isOpen: true, type: 'add', data: null, stationId: selectedStation.id })}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm transition-all-300"
                    >
                      Add RE Plant
                    </button>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase select-none">
                            <th className="p-4">Plant Name</th>
                            <th className="p-4">Evacuating Line</th>
                            <th className="p-4">MW</th>
                            <th className="p-4">Owner</th>
                            <th className="p-4">OEM</th>
                            <th className="p-4">Ref Voltage</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {stationLoading ? (
                            <tr><td colSpan={7} className="py-10 text-center text-slate-400">Loading...</td></tr>
                          ) : stationPlants.length === 0 ? (
                            <tr><td colSpan={7} className="py-10 text-center text-slate-400">No RE plants in this station yet.</td></tr>
                          ) : stationPlants.map(p => (
                            <tr
                              key={p.id}
                              className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                              onClick={() => setDetailModal({ isOpen: true, type: 'ppc', data: p })}
                            >
                              <td className="p-4 font-semibold text-slate-800">
                                {p.plant_name}
                              </td>
                              <td className="p-4 text-slate-500 font-medium">{p.evacuating_line || '—'}</td>
                              <td className="p-4 font-bold text-teal-700">{p.capacity_mw}</td>
                              <td className="p-4 text-slate-600">{p.owner || '—'}</td>
                              <td className="p-4 text-slate-700 font-medium">{p.ppc_oem || <span className="text-amber-500 text-xs font-semibold">Pending</span>}</td>
                              <td className="p-4 text-slate-600">{p.ppc_reference_voltage_kv ? `${p.ppc_reference_voltage_kv} kV` : '—'}</td>
                              <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setPpcModal({ isOpen: true, type: 'edit', data: p, stationId: selectedStation.id })}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all-300"
                                    title="Edit RE Plant"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm({ isOpen: true, type: 'ppc-plant', id: p.id, message: `Delete RE plant "${p.plant_name}"?` })}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all-300"
                                    title="Delete RE Plant"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: INVERTERS */}
          {activeTab === 'inverters' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Inverters Grid Management</h2>
                  <p className="text-sm text-slate-500 font-medium">Monitor statuses and run diagnostics logs</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-sm transition-all-300 flex items-center gap-2 shadow-sm"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </button>
                  <button
                    onClick={() => setInverterModal({ isOpen: true, type: 'add', data: null })}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm transition-all-300"
                  >
                    Add Inverter
                  </button>
                </div>
              </div>

              {/* Filters & Search bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Search Inverters</label>
                  <input
                    type="text"
                    placeholder="Search Make, Model, Type..."
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 transition-all-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Power Plant Filter</label>
                  <select
                    value={invPlantFilter}
                    onChange={(e) => { setInvPlantFilter(e.target.value); setInvPage(1); }}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                  >
                    <option value="">All Plants</option>
                    {plants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Device Type</label>
                  <select
                    value={invTypeFilter}
                    onChange={(e) => { setInvTypeFilter(e.target.value); setInvPage(1); }}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                  >
                    <option value="All">All Devices</option>
                    <option value="Central">Central Inverters</option>
                    <option value="String">String Inverters</option>
                    <option value="WTG">WTG (Wind)</option>
                    <option value="BESS">BESS (Battery)</option>
                    <option value="SVG">SVG</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase select-none">
                        <th onClick={() => handleSort('make')} className="p-4 cursor-pointer hover:bg-slate-100/50">
                          Make {invSort === 'make' && (invOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('model')} className="p-4 cursor-pointer hover:bg-slate-100/50">
                          Model {invSort === 'model' && (invOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('type')} className="p-4 cursor-pointer hover:bg-slate-100/50">
                          Type {invSort === 'type' && (invOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="p-4">Plant</th>
                        <th onClick={() => handleSort('count')} className="p-4 cursor-pointer hover:bg-slate-100/50">
                          Units {invSort === 'count' && (invOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('capacity_mw')} className="p-4 cursor-pointer hover:bg-slate-100/50">
                          Unit Cap {invSort === 'capacity_mw' && (invOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('total_capacity_mw')} className="p-4 cursor-pointer hover:bg-slate-100/50">
                          Total (MW) {invSort === 'total_capacity_mw' && (invOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {inverters.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-8 text-slate-455 font-medium">No inverter groups matched your search filters.</td>
                        </tr>
                      ) : (
                        inverters.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setDetailModal({ isOpen: true, type: 'inverter', data: inv })}>
                            <td className="p-4 font-semibold text-slate-800">{inv.make}</td>
                            <td className="p-4 text-slate-600 font-medium">{inv.model}</td>
                            <td className="p-4 text-slate-450">{inv.type}</td>
                            <td className="p-4 text-slate-500 font-semibold">{inv.plant_name}</td>
                            <td className="p-4 font-bold text-slate-700">{inv.count} units</td>
                            <td className="p-4 font-semibold text-slate-700">{Number(inv.capacity_mw).toFixed(4)} MW</td>
                            <td className="p-4 font-bold text-teal-600">{Number(inv.total_capacity_mw).toFixed(2)} MW</td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setInverterModal({ isOpen: true, type: 'edit', data: inv })}
                                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all-300"
                                  title="Edit Inverter Group"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleOpenDeleteInverter(inv)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all-300"
                                  title="Delete Inverter Group"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {invTotalPages > 1 && (
                  <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-slate-50/40 text-sm select-none">
                    <button
                      onClick={() => setInvPage(prev => Math.max(prev - 1, 1))}
                      disabled={invPage === 1}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg font-semibold text-slate-600 disabled:opacity-40 transition-all-300"
                    >
                      Previous
                    </button>
                    <span className="text-slate-500 font-medium">Page {invPage} of {invTotalPages}</span>
                    <button
                      onClick={() => setInvPage(prev => Math.min(prev + 1, invTotalPages))}
                      disabled={invPage === invTotalPages}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg font-semibold text-slate-600 disabled:opacity-40 transition-all-300"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">User Profiles Management</h2>
                  <p className="text-sm text-slate-500 font-medium">Administer system users, configure logins, and grant database permissions</p>
                </div>
                <button
                  onClick={handleOpenAddUserModal}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm transition-all-300"
                >
                  Add User
                </button>
              </div>

              {/* Users table */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-400 font-bold uppercase">
                        <th className="p-4">Username</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Plants Assigned</th>
                        <th className="p-4">Created At</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-semibold text-slate-800">{u.username}</td>
                          <td className="p-4 text-slate-500 text-xs">{u.email}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border capitalize ${
                              u.role === 'admin'
                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4">
                            {u.role === 'admin' ? (
                              <span className="text-slate-400 text-xs font-semibold">ALL (Admin bypass)</span>
                            ) : u.plant_count > 0 ? (
                              <span className="font-bold text-slate-700">{u.plant_count} plants</span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">No permissions assigned</span>
                            )}
                          </td>
                          <td className="p-4 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {u.role !== 'admin' && (
                                <button
                                  onClick={() => handleOpenPermissionsPanel(u)}
                                  className="px-2.5 py-1 text-xs font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-all-300"
                                  title="Manage plant permissions overrides"
                                >
                                  Permissions
                                </button>
                              )}
                              <button
                                onClick={() => setPwdModal({ isOpen: true, userId: u.id })}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all-300"
                                title="Reset user password"
                              >
                                Password
                              </button>
                              <button
                                onClick={() => handleOpenEditUserModal(u)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all-300"
                                title="Edit user details"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleOpenDeleteUser(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all-300"
                                title="Delete user"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PERMISSIONS OVERVIEW */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Operational Access Control</h2>
                <p className="text-sm text-slate-500 font-medium">Global mapping log of all user permissions overrides and plant roles</p>
              </div>

              {/* Summary of permissions */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50/40 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Granted Privileges Log</h3>
                </div>
                <div className="p-6">
                  {users.filter(u => u.role !== 'admin').length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-6">No operator user profiles created.</div>
                  ) : (
                    <div className="space-y-6">
                      {users.filter(u => u.role !== 'admin').map(u => (
                        <div key={u.id} className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{u.username}</span>
                              <span className="text-xs text-slate-400">({u.email})</span>
                            </div>
                            <button
                              onClick={() => handleOpenPermissionsPanel(u)}
                              className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:underline focus:outline-none"
                            >
                              Edit Assignments
                            </button>
                          </div>
                          
                          {/* Inner list of permissions */}
                          <UserPermissionsList userId={u.id} showToast={showToast} plants={plants} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- MODAL DIALOGS --- */}

      {/* MODAL: PLANT CRUD */}
      {plantModal.isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4 capitalize">
              {plantModal.type === 'add' ? 'Add Power Plant' : 'Edit Power Plant'}
            </h3>
            {poolingStations.length === 0 && plantModal.type === 'add' ? (
              <div className="text-center py-6">
                <span className="text-4xl">⚠️</span>
                <p className="mt-4 text-slate-700 font-bold">
                  No pooling stations are registered in the system.
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-6">
                  You must register a pooling station before you can create a power plant.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlantModal({ isOpen: false, type: 'add', data: null })}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlantModal({ isOpen: false, type: 'add', data: null });
                      setActiveTab('pooling-stations');
                      setStationModal({ isOpen: true, type: 'add', data: null });
                    }}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-sm shadow-lg shadow-rose-100"
                  >
                    Add Pooling Station
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePlant} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Plant Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      defaultValue={plantModal.type === 'edit' ? plantModal.data.name : ''}
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
                      defaultValue={plantModal.type === 'edit' ? plantModal.data.location : ''}
                      placeholder="e.g. Jodhpur, Rajasthan"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Assign to User</label>
                    <select
                      name="company_group"
                      defaultValue={plantModal.type === 'edit' ? plantModal.data.company_group : ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="">— Select User —</option>
                      {users.filter(u => u.role === 'user').map(u => (
                        <option key={u.id} value={u.username}>{u.username}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pooling Station</label>
                    <select
                      name="pooling_station"
                      defaultValue={plantModal.type === 'edit' ? plantModal.data.pooling_station : ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="">— Select Pooling Station —</option>
                      {poolingStations.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity (MW)</label>
                    <input
                      type="number"
                      step="0.001"
                      name="capacity_mw"
                      required
                      defaultValue={plantModal.type === 'edit' ? plantModal.data.capacity_mw : ''}
                      placeholder="150.00"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Commissioned Date</label>
                    <input
                      type="date"
                      name="commissioned_date"
                      defaultValue={plantModal.type === 'edit' && plantModal.data.commissioned_date ? new Date(plantModal.data.commissioned_date).toISOString().split('T')[0] : ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPlantModal({ isOpen: false, type: 'add', data: null })}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm"
                  >
                    {plantModal.type === 'add' ? 'Create Plant' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: INVERTER CRUD */}
      {inverterModal.isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4 capitalize">
              {inverterModal.type === 'add' ? 'Register Inverter' : 'Edit Inverter'}
            </h3>
            {plants.length === 0 && inverterModal.type === 'add' ? (
              <div className="text-center py-6">
                <span className="text-4xl">⚠️</span>
                <p className="mt-4 text-slate-700 font-bold">
                  No power plants are registered in the system.
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-6">
                  You must create a power plant before you can assign inverters to it.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setInverterModal({ isOpen: false, type: 'add', data: null })}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInverterModal({ isOpen: false, type: 'add', data: null });
                      setActiveTab('plants');
                      setPlantModal({ isOpen: true, type: 'add', data: null });
                    }}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-sm shadow-lg shadow-rose-100"
                  >
                    Create Power Plant
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveInverter} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Power Plant Assignment</label>
                  {inverterModal.type === 'add' ? (
                    <select
                      name="plant_id"
                      required
                      defaultValue={inverterModal.data?.plant_id || ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="">Select Target Grid Plant...</option>
                      {plants.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={inverterModal.data.plant_name}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-400"
                    />
                  )}
                  {inverterModal.type === 'edit' && (
                    <input type="hidden" name="plant_id" value={inverterModal.data.plant_id} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Make (Manufacturer)</label>
                    <input
                      type="text"
                      name="make"
                      required
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.make : ''}
                      placeholder="HUAWEI"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Model Name</label>
                    <input
                      type="text"
                      name="model"
                      required
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.model : ''}
                      placeholder="SUN2000-185KTL-H1"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Element Type</label>
                    <select
                      name="type"
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.type : 'String'}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="String">String Inverters</option>
                      <option value="Central">Central Inverters</option>
                      <option value="WTG">WTG (Wind)</option>
                      <option value="BESS">BESS (Battery)</option>
                      <option value="SVG">SVG</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Rating (MVA)</label>
                    <input
                      type="number"
                      step="0.001"
                      name="rating_mva"
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.rating_mva : ''}
                      placeholder="0.16"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Unit Count</label>
                    <input
                      type="number"
                      name="count"
                      required
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.count : '1'}
                      placeholder="e.g. 313"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity per Unit (MW)</label>
                    <input
                      type="number"
                      step="0.0001"
                      name="capacity_mw"
                      required
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.capacity_mw : ''}
                      placeholder="3.1250"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Total Capacity (MW)</label>
                    <input
                      type="number"
                      step="0.001"
                      name="total_capacity_mw"
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.total_capacity_mw : ''}
                      placeholder="Leave empty to auto-calculate"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pooling Station</label>
                    <select
                      name="pooling_station"
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.pooling_station : ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="">— Select Pooling Station —</option>
                      {poolingStations.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Owner / Operator</label>
                    <input
                      type="text"
                      name="owner"
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.owner : ''}
                      placeholder="e.g. Adani"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Efficiency %</label>
                    <input
                      type="number"
                      step="0.01"
                      name="efficiency_percent"
                      defaultValue={inverterModal.type === 'edit' ? inverterModal.data.efficiency_percent : ''}
                      placeholder="e.g. 98.50"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Last Maintenance Date</label>
                    <input
                      type="date"
                      name="last_maintenance_date"
                      defaultValue={inverterModal.type === 'edit' && inverterModal.data.last_maintenance_date ? new Date(inverterModal.data.last_maintenance_date).toISOString().split('T')[0] : ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setInverterModal({ isOpen: false, type: 'add', data: null })}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm"
                  >
                    {inverterModal.type === 'add' ? 'Register' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* MODAL: USER CRUD */}
      {userModal.isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 animate-scale-up max-h-[90vh] flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-4 capitalize flex-shrink-0">
              {userModal.type === 'add' ? 'Create User Account' : 'Edit User Profile'}
            </h3>
            <form onSubmit={handleSaveUser} className="space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[60vh]">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Username</label>
                  <input
                    type="text"
                    name="username"
                    required
                    defaultValue={userModal.type === 'edit' ? userModal.data.username : ''}
                    placeholder="e.g. operator1"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={userModal.type === 'edit' ? userModal.data.email : ''}
                    placeholder="e.g. operator1@grid.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                  />
                </div>

                {userModal.type === 'add' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Default Password</label>
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">System Role</label>
                  <select
                    name="role"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                  >
                    <option value="user">Operator (Standard User)</option>
                    <option value="admin">Grid Admin (Global Bypass)</option>
                  </select>
                </div>




              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setUserModal({ isOpen: false, type: 'add', data: null })}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm"
                >
                  {userModal.type === 'add' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POOLING STATION CRUD */}
      {stationModal.isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4 capitalize">
              {stationModal.type === 'add' ? 'Add Pooling Station' : 'Edit Pooling Station'}
            </h3>
            <form onSubmit={handleSaveStation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Pooling Station Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={stationModal.type === 'edit' ? stationModal.data.name : ''}
                  placeholder="e.g. Bikaner (PG)"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                />
              </div>



              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total Capacity (MW)</label>
                <input
                  type="number"
                  step="0.001"
                  name="total_capacity_mw"
                  defaultValue={stationModal.type === 'edit' ? stationModal.data.total_capacity_mw : ''}
                  placeholder="e.g. 1500"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStationModal({ isOpen: false, type: 'add', data: null })}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm"
                >
                  {stationModal.type === 'add' ? 'Create Station' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RE PLANT (PPC PLANT) CRUD */}
      {ppcModal.isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 animate-scale-up max-h-[90vh] flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex-shrink-0">
              {ppcModal.type === 'add' ? 'Add RE Plant' : 'Edit RE Plant'}
            </h3>
            <form onSubmit={handleSavePpcPlant} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[65vh]">

                {/* Basic Info */}
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Basic Information</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Plant Name <span className="text-rose-500">*</span></label>
                    <input type="text" name="plant_name" required
                      defaultValue={ppcModal.data?.plant_name || ''}
                      placeholder="e.g. Bikaner Solar 1"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Link to Parent Power Plant</label>
                    <select
                      name="power_plant_id"
                      defaultValue={ppcModal.data?.power_plant_id || ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="">-- None / Select Plant --</option>
                      {plants.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.capacity_mw} MW)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">WBES Acronym</label>
                    <input type="text" name="wbes_acronym"
                      defaultValue={ppcModal.data?.wbes_acronym || ''}
                      placeholder="e.g. BKNR_S1"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity (MW)</label>
                    <input type="number" step="0.001" name="capacity_mw"
                      defaultValue={ppcModal.data?.capacity_mw || ''}
                      placeholder="e.g. 250"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Owner / Operator</label>
                    <input type="text" name="owner"
                      defaultValue={ppcModal.data?.owner || ''}
                      placeholder="e.g. Adani Green"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Evacuating Line</label>
                    <input type="text" name="evacuating_line"
                      defaultValue={ppcModal.data?.evacuating_line || ''}
                      placeholder="e.g. 220kV Bikaner–Sikar"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Point of Interconnection (POI)</label>
                    <input type="text" name="poi"
                      defaultValue={ppcModal.data?.poi || ''}
                      placeholder="e.g. 220kV Bikaner SS"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                </div>

                {/* PPC Settings */}
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mt-2">PPC Configuration</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">PPC OEM</label>
                    <input type="text" name="ppc_oem"
                      defaultValue={ppcModal.data?.ppc_oem || ''}
                      placeholder="e.g. ABB"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Mode of Control</label>
                    <input type="text" name="ppc_mode_of_control"
                      defaultValue={ppcModal.data?.ppc_mode_of_control || ''}
                      placeholder="e.g. Auto"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Reference Point</label>
                    <input type="text" name="ppc_reference_point"
                      defaultValue={ppcModal.data?.ppc_reference_point || ''}
                      placeholder="e.g. LV Bus"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Reference Voltage (kV)</label>
                    <input type="number" step="0.001" name="ppc_reference_voltage_kv"
                      defaultValue={ppcModal.data?.ppc_reference_voltage_kv || ''}
                      placeholder="e.g. 220"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Voltage Deadband (%)</label>
                    <input type="number" step="0.001" name="ppc_voltage_deadband_pct"
                      defaultValue={ppcModal.data?.ppc_voltage_deadband_pct || ''}
                      placeholder="e.g. 2.5"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Voltage Droop (%)</label>
                    <input type="number" step="0.001" name="ppc_voltage_droop_pct"
                      defaultValue={ppcModal.data?.ppc_voltage_droop_pct || ''}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Max Q Injection (MVAr)</label>
                    <input type="number" step="0.001" name="max_reactive_power_injection_mvar"
                      defaultValue={ppcModal.data?.max_reactive_power_injection_mvar || ''}
                      placeholder="e.g. 120"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Max Q Absorption (MVAr)</label>
                    <input type="number" step="0.001" name="max_reactive_power_absorption_mvar"
                      defaultValue={ppcModal.data?.max_reactive_power_absorption_mvar || ''}
                      placeholder="e.g. 80"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Comm Time (ms)</label>
                    <input type="number" step="1" name="ppc_comm_time_ms"
                      defaultValue={ppcModal.data?.ppc_comm_time_ms || ''}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sampling Time (ms)</label>
                    <input type="number" step="1" name="ppc_sampling_time_ms"
                      defaultValue={ppcModal.data?.ppc_sampling_time_ms || ''}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Total Exec Time (ms)</label>
                    <input type="number" step="1" name="ppc_total_exec_time_ms"
                      defaultValue={ppcModal.data?.ppc_total_exec_time_ms || ''}
                      placeholder="e.g. 1000"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                </div>

                {/* Frequency Settings */}
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mt-2">Frequency Control</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Freq Control Mode</label>
                    <input type="text" name="freq_control_mode"
                      defaultValue={ppcModal.data?.freq_control_mode || ''}
                      placeholder="e.g. ROCOF"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Freq Deadband (Hz)</label>
                    <input type="number" step="0.001" name="freq_deadband"
                      defaultValue={ppcModal.data?.freq_deadband || ''}
                      placeholder="e.g. 0.05"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Freq Droop (%)</label>
                    <input type="number" step="0.001" name="freq_droop_pct"
                      defaultValue={ppcModal.data?.freq_droop_pct || ''}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Power Reduction @ 50.3Hz</label>
                    <input type="text" name="power_reduction_at_50_3hz"
                      defaultValue={ppcModal.data?.power_reduction_at_50_3hz || ''}
                      placeholder="e.g. 10%"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500" />
                  </div>
                </div>

              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 flex-shrink-0 mt-4">
                <button type="button"
                  onClick={() => setPpcModal({ isOpen: false, type: 'add', data: null, stationId: null })}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm">
                  {ppcModal.type === 'add' ? 'Add RE Plant' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {pwdModal.isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-sm w-full p-6 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              Reset Password
            </h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPwdModal({ isOpen: false, userId: null })}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIDE PANEL: PERMISSIONS BATCH ASSIGN */}
      {permPanel.isOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col animate-slide-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit Plant Assignments</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Access scope for <span className="text-rose-500 font-bold">@{permPanel.targetUser.username}</span>
                </p>
              </div>
              <button
                onClick={() => setPermPanel({ isOpen: false, targetUser: null, userPerms: [], allPlants: [], allCompanyGroups: [], selectedCompanyGroup: '' })}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Company Group Switcher */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/60 flex-shrink-0 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <select
                value={permPanel.selectedCompanyGroup || ''}
                onChange={(e) => handleChangePermCompany(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="">-- Select Company Group --</option>
                {permPanel.allCompanyGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <span className="text-xs text-slate-400 font-semibold ml-auto">{permPanel.userPerms.length} plant(s)</span>
            </div>

            {/* Plant Permission Rows */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {permPanel.userPerms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <svg className="w-10 h-10 text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-sm text-slate-500 font-semibold">No plants assigned yet</p>
                  <p className="text-xs text-slate-300 mt-1 mb-4">Add the first plant for this user below</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPermPanelContext({
                        userId: permPanel.targetUser.id,
                        username: permPanel.targetUser.username,
                        companyGroup: permPanel.selectedCompanyGroup || '',
                      });
                      setPlantModal({
                        isOpen: true,
                        type: 'add',
                        data: { company_group: permPanel.selectedCompanyGroup || '' }
                      });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-100 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add First Plant
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-2 mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plant Name</span>
                    <div className="flex items-center gap-6 pr-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Read</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Write</span>
                    </div>
                  </div>

                  {permPanel.userPerms.map((up) => (
                    <div
                      key={up.plantId}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all duration-200 ${
                        up.canWrite
                          ? 'bg-rose-50/60 border-rose-200'
                          : up.canRead
                          ? 'bg-teal-50/60 border-teal-200'
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <span className="text-sm font-semibold text-slate-800 block truncate">{up.plantName}</span>
                        <span className={`text-xs font-bold mt-0.5 inline-block ${
                          up.canWrite ? 'text-rose-500' : up.canRead ? 'text-teal-600' : 'text-slate-400'
                        }`}>
                          {up.canWrite ? '● Read & Write' : up.canRead ? '● Read Only' : '○ No Access'}
                        </span>
                      </div>

                      {/* Add Inverter shortcut */}
                      <button
                        type="button"
                        title="Add inverter to this plant"
                        onClick={() => {
                          setInverterModal({ isOpen: true, type: 'add', data: { plant_id: up.plantId } });
                        }}
                        className="flex-shrink-0 mr-3 px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-200 whitespace-nowrap"
                      >
                        ＋ Inverter
                      </button>

                      <div className="flex items-center gap-5 flex-shrink-0">
                        {/* Read Toggle */}
                        <label className="flex flex-col items-center gap-1 cursor-pointer select-none">
                          <div
                            onClick={() => handleTogglePermCheckbox(up.plantId, 'canRead')}
                            className={`w-10 h-5 rounded-full transition-all duration-300 relative cursor-pointer ${
                              up.canRead ? 'bg-teal-500' : 'bg-slate-200'
                            }`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-all duration-300 ${
                              up.canRead ? 'left-5' : 'left-0.5'
                            }`} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Read</span>
                        </label>

                        {/* Write Toggle */}
                        <label className="flex flex-col items-center gap-1 cursor-pointer select-none">
                          <div
                            onClick={() => handleTogglePermCheckbox(up.plantId, 'canWrite')}
                            className={`w-10 h-5 rounded-full transition-all duration-300 relative cursor-pointer ${
                              up.canWrite ? 'bg-rose-500' : 'bg-slate-200'
                            }`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-all duration-300 ${
                              up.canWrite ? 'left-5' : 'left-0.5'
                            }`} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Write</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Plant button — always shown */}
              <button
                type="button"
                onClick={() => {
                  setPermPanelContext({
                    userId: permPanel.targetUser.id,
                    username: permPanel.targetUser.username,
                    companyGroup: permPanel.selectedCompanyGroup || '',
                  });
                  setPlantModal({
                    isOpen: true,
                    type: 'add',
                    data: { company_group: permPanel.selectedCompanyGroup || '' }
                  });
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-semibold text-slate-500 hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50/40 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                {permPanel.selectedCompanyGroup ? `Add Plant for ${permPanel.selectedCompanyGroup}` : 'Add New Plant'}
              </button>
            </div>

            {/* Save Action Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center flex-shrink-0 bg-slate-50/40">
              <div className="text-xs text-slate-400 font-medium">
                {permPanel.userPerms.filter(p => p.canRead || p.canWrite).length} of {permPanel.userPerms.length} plants granted
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPermPanel({ isOpen: false, targetUser: null, userPerms: [], allPlants: [], allCompanyGroups: [], selectedCompanyGroup: '' })}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-all-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBatchPermissions}
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 text-sm transition-all-300"
                >
                  Save Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIDE DRAWER: SESSION ACTIVITY LOG */}
      {isLogDrawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 text-slate-350 h-full w-full max-w-md p-6 shadow-2xl flex flex-col justify-between animate-slide-left border-l border-slate-800">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">System Logs Drawer</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Persistent database-backed settings change logs</p>
                </div>
                <button
                  onClick={() => setIsLogDrawerOpen(false)}
                  className="text-slate-500 hover:text-slate-300 focus:outline-none"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Logs display */}
              <div className="space-y-3.5 max-h-[80vh] overflow-y-auto pr-2 font-mono text-[11px] leading-relaxed">
                {systemLogs.length === 0 ? (
                  <div className="text-slate-550 italic py-4">No system logs recorded.</div>
                ) : (
                  systemLogs.map((log) => (
                    <div key={log.id} className="border-b border-slate-850 pb-2.5">
                      <div className="flex justify-between items-center text-slate-500 mb-1 font-bold">
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                        <span className="text-teal-500">{log.username}</span>
                      </div>
                      <div className="text-rose-400 font-bold mb-0.5">{log.action}</div>
                      <div className="text-slate-350">{log.details}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-800/80">
              <button
                onClick={() => setIsLogDrawerOpen(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-white font-semibold rounded-xl text-xs transition-all-300"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDE DRAWER: FREQUENCY CONTROL PANEL */}
      {isFreqPanelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white h-full w-full max-w-md p-6 shadow-2xl flex flex-col justify-between animate-slide-left border-l border-slate-200">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Frequency Control Mode</h3>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Inverters grouped by Freq Control Mode setting</p>
                </div>
                <button
                  onClick={() => setIsFreqPanelOpen(false)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Grouped Lists */}
              <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 select-none">
                {(() => {
                  const groups = getGroupedFreqInverters();
                  return ['ROCOF', 'df/dt', 'None'].map(mode => {
                    const list = groups[mode] || [];
                    const badgeColor = 
                      mode === 'ROCOF' 
                        ? 'bg-teal-50 text-teal-700 border-teal-100' 
                        : mode === 'df/dt'
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200';
                        
                    return (
                      <div key={mode} className="space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${badgeColor}`}>
                            {mode}
                          </span>
                          <span className="text-xs font-bold text-slate-450">{list.length} inverter groups</span>
                        </div>

                        {list.length === 0 ? (
                          <div className="text-xs text-slate-400 italic py-2">No inverters in this mode.</div>
                        ) : (
                          <div className="space-y-2">
                            {list.map(i => (
                              <div key={i.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-bold text-slate-700">{i.make} {i.model}</span>
                                  <span className="block text-slate-400 font-semibold mt-0.5">{i.plant_name} · {i.type}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-slate-800">{i.count} units</span>
                                  <span className="block text-slate-400 font-semibold mt-0.5">{Number(i.total_capacity_mw).toFixed(2)} MW</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsFreqPanelOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all-300 shadow-md shadow-slate-100"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}      {/* Reusable Confirm Delete */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Resource Warning"
        message={deleteConfirm.message}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, type: '', id: null, message: '' })}
      />

      {/* Tech details preview modal */}
      {detailModal.isOpen && detailModal.data && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {detailModal.type === 'inverter'
                    ? `Inverter Group: ${detailModal.data.make} ${detailModal.data.model}`
                    : detailModal.type === 'plant'
                    ? `Power Plant: ${detailModal.data.name}`
                    : `RE Plant Controller: ${detailModal.data.plant_name}`}
                </h3>
              </div>
              <button
                onClick={() => setDetailModal({ isOpen: false, type: '', data: null })}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg hover:bg-slate-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Power Plant details display */}
            {detailModal.type === 'plant' && (
              <div className="space-y-6 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    ['Plant Name', detailModal.data.name],
                    ['Owner / Operator', detailModal.data.owner],
                    ['Company Group', detailModal.data.company_group],
                    ['Capacity (MW)', `${detailModal.data.capacity_mw} MW`],
                    ['Location / Area', detailModal.data.location],
                    ['Pooling Station Connection', detailModal.data.pooling_station],
                    ['Commissioned Date', detailModal.data.commissioned_date ? new Date(detailModal.data.commissioned_date).toLocaleDateString() : '—'],
                    ['Inverter Units Count', detailModal.data.inverter_count ? `${detailModal.data.inverter_count} units` : '0 units'],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lbl}</span>
                      <span className="font-semibold text-slate-700">{val || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inverter details display */}
            {detailModal.type === 'inverter' && (
              <div className="space-y-6 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    ['Make (OEM)', detailModal.data.make],
                    ['Model', detailModal.data.model],
                    ['Inverter Type', detailModal.data.type],
                    ['Units Count', `${detailModal.data.count} units`],
                    ['Unit Capacity', `${detailModal.data.capacity_mw} MW`],
                    ['Total Capacity', `${detailModal.data.total_capacity_mw} MW`],
                    ['Rating (MVA)', detailModal.data.rating_mva ? `${detailModal.data.rating_mva} MVA` : '—'],
                    ['Pooling Station', detailModal.data.pooling_station],
                    ['Owner', detailModal.data.owner],
                    ['Last Maintenance', detailModal.data.last_maintenance_date ? new Date(detailModal.data.last_maintenance_date).toLocaleDateString() : '—'],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lbl}</span>
                      <span className="font-semibold text-slate-700">{val || '—'}</span>
                    </div>
                  ))}
                </div>

                {/* Ride Through Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* LVRT */}
                  <div className="bg-blue-50/20 border border-blue-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                      Low Voltage Ride Through (LVRT)
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">Trigger Threshold</span>
                        <span className="font-bold text-slate-700">{detailModal.data.lvrt?.triggering_threshold_pu ?? '—'} pu</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">UV Stage 1</span>
                        <span className="font-bold text-slate-700">{detailModal.data.lvrt?.uv_stage1_voltage_pu ?? '—'} pu ({detailModal.data.lvrt?.uv_stage1_time_ms ?? '—'} ms)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">UV Stage 2</span>
                        <span className="font-bold text-slate-700">{detailModal.data.lvrt?.uv_stage2_voltage_pu ?? '—'} pu ({detailModal.data.lvrt?.uv_stage2_time_ms ?? '—'} ms)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">UV Stage 3</span>
                        <span className="font-bold text-slate-700">{detailModal.data.lvrt?.uv_stage3_voltage_pu ?? '—'} pu ({detailModal.data.lvrt?.uv_stage3_time_ms ?? '—'} ms)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400 font-semibold">K-Factor</span>
                        <span className="font-bold text-slate-700">{detailModal.data.lvrt?.k_factor ?? '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* HVRT */}
                  <div className="bg-rose-50/20 border border-rose-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-rose-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      High Voltage Ride Through (HVRT)
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">Trigger Threshold</span>
                        <span className="font-bold text-slate-700">{detailModal.data.hvrt?.triggering_threshold_pu ?? '—'} pu</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">OV Stage 1</span>
                        <span className="font-bold text-slate-700">{detailModal.data.hvrt?.ov_stage1_voltage_pu ?? '—'} pu ({detailModal.data.hvrt?.ov_stage1_time_ms ?? '—'} ms)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">OV Stage 2</span>
                        <span className="font-bold text-slate-700">{detailModal.data.hvrt?.ov_stage2_voltage_pu ?? '—'} pu ({detailModal.data.hvrt?.ov_stage2_time_ms ?? '—'} ms)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">OV Stage 3</span>
                        <span className="font-bold text-slate-700">{detailModal.data.hvrt?.ov_stage3_voltage_pu ?? '—'} pu ({detailModal.data.hvrt?.ov_stage3_time_ms ?? '—'} ms)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400 font-semibold">K-Factor</span>
                        <span className="font-bold text-slate-700">{detailModal.data.hvrt?.k_factor ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PPC details display */}
            {detailModal.type === 'ppc' && (
              <div className="space-y-6 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    ['Plant Name', detailModal.data.plant_name],
                    ['WBES Acronym', detailModal.data.wbes_acronym],
                    ['Capacity (MW)', `${detailModal.data.capacity_mw} MW`],
                    ['Evacuating Line', detailModal.data.evacuating_line],
                    ['POI', detailModal.data.poi],
                    ['Owner', detailModal.data.owner],
                    ['PPC OEM', detailModal.data.ppc_oem],
                    ['Mode of Control', detailModal.data.ppc_mode_of_control],
                    ['Reference Point', detailModal.data.ppc_reference_point],
                    ['Reference Voltage', detailModal.data.ppc_reference_voltage_kv ? `${detailModal.data.ppc_reference_voltage_kv} kV` : '—'],
                    ['Voltage Deadband', detailModal.data.ppc_voltage_deadband_pct],
                    ['Voltage Droop', detailModal.data.ppc_voltage_droop_pct],
                    ['Max Q Injection', detailModal.data.max_reactive_power_injection_mvar ? `${detailModal.data.max_reactive_power_injection_mvar} MVAr` : '—'],
                    ['Max Q Absorption', detailModal.data.max_reactive_power_absorption_mvar ? `${detailModal.data.max_reactive_power_absorption_mvar} MVAr` : '—'],
                    ['Pooling Station Name', detailModal.data.pooling_station_name],
                    ['Comm Time', detailModal.data.ppc_comm_time_ms ? `${detailModal.data.ppc_comm_time_ms} ms` : '—'],
                    ['Sampling Time', detailModal.data.ppc_sampling_time_ms ? `${detailModal.data.ppc_sampling_time_ms} ms` : '—'],
                    ['Total Execution Time', detailModal.data.ppc_total_exec_time_ms ? `${detailModal.data.ppc_total_exec_time_ms} ms` : '—'],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lbl}</span>
                      <span className="font-semibold text-slate-700">{val || '—'}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Frequency Control Group */}
                  <div className="bg-teal-50/20 border border-teal-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      Frequency Control Settings
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">Control Mode</span>
                        <span className="font-bold text-slate-700">{detailModal.data.freq_control_mode || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">Freq Deadband</span>
                        <span className="font-bold text-slate-700">{detailModal.data.freq_deadband || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">Freq Droop</span>
                        <span className="font-bold text-slate-700">{detailModal.data.freq_droop_pct || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400 font-semibold">Power Red. @50.3Hz</span>
                        <span className="font-bold text-slate-700">{detailModal.data.power_reduction_at_50_3hz || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Execution Group */}
                  <div className="bg-emerald-50/20 border border-emerald-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      Execution & Comm Metrics
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">Comm Time</span>
                        <span className="font-bold text-slate-700">{detailModal.data.ppc_comm_time_ms ? `${detailModal.data.ppc_comm_time_ms} ms` : '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400 font-semibold">Sampling Time</span>
                        <span className="font-bold text-slate-700">{detailModal.data.ppc_sampling_time_ms ? `${detailModal.data.ppc_sampling_time_ms} ms` : '—'}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400 font-semibold">Total Execution Time</span>
                        <span className="font-bold text-slate-700">{detailModal.data.ppc_total_exec_time_ms ? `${detailModal.data.ppc_total_exec_time_ms} ms` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => setDetailModal({ isOpen: false, type: '', data: null })}
                className="px-5 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
// Helper internal component to render active permissions list for each user dynamically
const UserPermissionsList = ({ userId, showToast, plants }) => {
  const [permsList, setPermsList] = useState([]);
  
  useEffect(() => {
    const fetchPerms = async () => {
      try {
        const res = await permissionsAPI.getByUserId(userId);
        setPermsList(res.permissions);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPerms();
  }, [userId]);

  if (permsList.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic">No power plants scopes assigned to this operator.</div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {permsList.map((p) => (
        <span
          key={p.id}
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            p.can_write
              ? 'bg-rose-50/20 text-rose-600 border-rose-500/20'
              : 'bg-teal-50/20 text-teal-600 border-teal-500/20'
          }`}
        >
          {p.plant_name}: {p.can_write ? 'Read & Write' : 'Read Only'}
        </span>
      ))}
    </div>
  );
};

export default AdminDashboard;
