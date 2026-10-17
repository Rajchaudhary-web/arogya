import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Root "/" route: redirect to role-specific dashboard once profile is loaded.
 * Shows nothing while loading to avoid flash.
 */
export default function RootRedirect() {
  const { profile, loading, session } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="spinner spinner-primary" />
      </div>
    )
  }

  if (!session) return <Navigate to="/auth" replace />

  if (profile?.role === 'asha') return <Navigate to="/asha" replace />
  return <Navigate to="/patient" replace />
}
