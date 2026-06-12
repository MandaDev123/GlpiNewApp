import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// FrontOffice
import ItemList from './pages/front/ItemList';
import CreateTicket from './pages/front/CreateTicket';
import TicketKanban from './pages/front/TicketKanban'; //

// BackOffice
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import ImportData from './pages/admin/Import';
import Reset from './pages/admin/Reset';
import Tickets from './pages/admin/Tickets';
import TicketDetail from './pages/admin/TicketDetail';
import KanbanSettings from './pages/admin/KanbanSettings'; //

import './index.css';

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Router>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main style={{ flex: 1, padding: '0 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
              <Routes>
                {/* FrontOffice Routes */}
                <Route path="/" element={<ItemList />} />
                <Route path="/create-ticket" element={<CreateTicket />} />
                {/* Route publique pour voir le tableau Kanban */}
                <Route path="/kanban" element={<TicketKanban />} />

                {/* BackOffice Routes */}
                <Route path="/login" element={<Login />} />

                {/* Protected Admin Routes */}
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin/import" element={
                  <ProtectedRoute>
                    <ImportData />
                  </ProtectedRoute>
                } />
                <Route path="/admin/reset" element={
                  <ProtectedRoute>
                    <Reset />
                  </ProtectedRoute>
                } />
                <Route path="/admin/tickets" element={
                  <ProtectedRoute>
                    <Tickets />
                  </ProtectedRoute>
                } />
                <Route path="/admin/tickets/:id" element={
                  <ProtectedRoute>
                    <TicketDetail />
                  </ProtectedRoute>
                } />

                {/* Nouvelle Route Admin pour personnaliser le Kanban */}
                <Route path="/admin/kanban-settings" element={
                  <ProtectedRoute>
                    <KanbanSettings />
                  </ProtectedRoute>
                } />

              </Routes>
            </main>
            <footer style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
              &copy; 2026 GLPI React Frontend App (Local State Edition)
            </footer>
          </div>
        </Router>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;