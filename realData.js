// =============================================================
//  realData.js — Energy Management App
//  Auto-generated from: Inverters_details_compiled.xlsx
//
//  43 power plants · 59 inverter groups · 33,161 total units
//  Company groups: Adani, Renew, Azure, ACME, TPREL, Thar Surya,
//                  Ayaana, Avaada, NTPC, Mahindra, Eden, CSPJPL,
//                  ABC Renewable
// =============================================================

export const powerPlants = [
  {
    id: 1,
    name: "Adani Solar Energy Four Private Limited",
    owner: "Adani",
    company_group: "Adani",
    pooling_station: "Bhadla(PG)",
    capacity_mw: 50.08,
    location: "Bhadla, Rajasthan"
  },
  {
    id: 8,
    name: "Adani Solar Energy Jaisalmer One Pvt Ltd 450MW",
    owner: "Adani",
    company_group: "Adani",
    pooling_station: "Fatehgarh-II(PG)",
    capacity_mw: 209.375,
    location: "Fatehgarh, Rajasthan"
  }
];

export const inverterGroups = [
  {
    id: 8,
    plant_id: 8,
    make: "SUNGROW",
    model: "SG3125HV",
    type: "Central",            // Central | String | WTG | BESS
    rating_mva: 3.125,
    capacity_kw: 3125.0,          // rating_mva × 1000
    count: 67,                      // number of physical units
    total_capacity_mw: 209.375,
    pooling_station: "Fatehgarh-II(PG)",
    owner: "Adani",
    status: "online",               // runtime field: "online"|"offline"|"fault"|"maintenance"
    efficiency_percent: null,        // runtime field — populate from SCADA/live data
    last_maintenance_date: null,     // TODO: fill in
    lvrt: {
      triggering_threshold_pu: 0.9,
      uv_stage1_voltage_pu: 0.9,
      uv_stage1_time_ms: 10000.0,
      uv_stage2_voltage_pu: 0.85,
      uv_stage2_time_ms: 3000.0,
      uv_stage3_voltage_pu: 0.15,
      uv_stage3_time_ms: 300.0,
      k_factor: 1.5,
    },
    hvrt: {
      triggering_threshold_pu: 1.15,
      ov_stage1_voltage_pu: 1.15,
      ov_stage1_time_ms: 2000.0,
      ov_stage2_voltage_pu: 1.2,
      ov_stage2_time_ms: 200.0,
      ov_stage3_voltage_pu: 1.3,
      ov_stage3_time_ms: 50.0,
      k_factor: 1.5,
    },
  }
];