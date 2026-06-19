import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import PlantDetail from './pages/PlantDetail';
import AdminDashboard from './pages/AdminDashboard';
import StationDashboard from './pages/StationDashboard';

// 404 Page Component
const NotFound = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
    <span className="text-5xl">🧭</span>
    <h2 className="text-2xl font-bold text-slate-800 mt-4">Page Not Found</h2>
    <p className="text-slate-400 mt-2 max-w-sm">The dashboard tab or resource path you are looking for does not exist or has been relocated.</p>
    <button
      onClick={() => window.history.back()}
      className="mt-6 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-all-300 shadow-md shadow-teal-50"
    >
      Go Back
    </button>
  </div>
);

function App() {
  return (
    <Routes>
      {/* Root redirects to default user login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Login routes (Login components handle redirecting authenticated users automatically) */}
      <Route path="/login" element={<Login />} />

      {/* Operator Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/plant/:id"
        element={
          <ProtectedRoute>
            <PlantDetail />
          </ProtectedRoute>
        }
      />

      {/* Station Dashboard Routes — accessible by pooling_station role AND admin (for preview) */}
      <Route
        path="/station-dashboard"
        element={
          <ProtectedRoute stationOnly>
            <StationDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/station-dashboard/:stationId"
        element={
          <ProtectedRoute adminOnly>
            <StationDashboard />
          </ProtectedRoute>
        }
      />

      {/* Administrator Dashboard Routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard/:tab"
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* 404 Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
