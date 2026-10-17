import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Header from './components/Header'
import AuthPage from './pages/AuthPage'
import RootRedirect from './pages/RootRedirect'
import PatientHome from './pages/PatientHome'
import AshaDashboard from './pages/AshaDashboard'
import PlaceholderPage from './pages/PlaceholderPage'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Protected — all under Layout with Header */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={<Layout><RootRedirect /></Layout>}
            />
            <Route
              path="/patient"
              element={<Layout><PatientHome /></Layout>}
            />
            <Route
              path="/asha"
              element={<Layout><AshaDashboard /></Layout>}
            />
            {/* Tile placeholder routes */}
            <Route path="/medicines" element={<Layout><PlaceholderPage /></Layout>} />
            <Route path="/records"   element={<Layout><PlaceholderPage /></Layout>} />
            <Route path="/checkin"   element={<Layout><PlaceholderPage /></Layout>} />
            <Route path="/ask"       element={<Layout><PlaceholderPage /></Layout>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
