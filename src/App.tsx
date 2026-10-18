import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import AuthPage from './pages/AuthPage'
import RootRedirect from './pages/RootRedirect'
import PatientHome from './pages/PatientHome'
import PatientRecordsPage from './pages/PatientRecordsPage'
import PatientMedicinesPage from './pages/PatientMedicinesPage'
import RequestVisitPage from './pages/RequestVisitPage'
import AshaDashboard from './pages/AshaDashboard'
import MyPatientsPage from './pages/MyPatientsPage'
import AddEditPatientPage from './pages/AddEditPatientPage'
import AshaPatientDetailPage from './pages/AshaPatientDetailPage'
import RequestsPage from './pages/RequestsPage'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Protected Routes inside AppLayout (Header + Desktop Sidebar + Mobile Tabbar + Footer) */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={<AppLayout><RootRedirect /></AppLayout>}
            />

            {/* Patient Routes */}
            <Route
              path="/patient"
              element={<AppLayout><PatientHome /></AppLayout>}
            />
            <Route
              path="/records"
              element={<AppLayout><PatientRecordsPage /></AppLayout>}
            />
            <Route
              path="/medicines"
              element={<AppLayout><PatientMedicinesPage /></AppLayout>}
            />
            <Route
              path="/ask-visit"
              element={<AppLayout><RequestVisitPage /></AppLayout>}
            />
            <Route
              path="/ask"
              element={<AppLayout><PlaceholderPage /></AppLayout>}
            />

            {/* ASHA Worker Routes */}
            <Route
              path="/asha"
              element={<AppLayout><AshaDashboard /></AppLayout>}
            />
            <Route
              path="/asha/patients"
              element={<AppLayout><MyPatientsPage /></AppLayout>}
            />
            <Route
              path="/asha/patients/add"
              element={<AppLayout><AddEditPatientPage /></AppLayout>}
            />
            <Route
              path="/asha/patients/:id/edit"
              element={<AppLayout><AddEditPatientPage /></AppLayout>}
            />
            <Route
              path="/asha/patients/:id"
              element={<AppLayout><AshaPatientDetailPage /></AppLayout>}
            />
            <Route
              path="/asha/requests"
              element={<AppLayout><RequestsPage /></AppLayout>}
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
