import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AgentProvider } from './context/AgentContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Wren from './pages/Wren'
import Landing from './pages/Landing'
import GoogleAuthCallback from './pages/GoogleAuthCallback'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AgentProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/wren" element={<ProtectedRoute><Wren /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
          {/* Legacy routes — redirect everything to /wren */}
          <Route path="/desk" element={<Navigate to="/wren" replace />} />
          <Route path="/dashboard" element={<Navigate to="/wren" replace />} />
          <Route path="/network" element={<Navigate to="/wren" replace />} />
          <Route path="/network/*" element={<Navigate to="/wren" replace />} />
          <Route path="/candidates" element={<Navigate to="/wren" replace />} />
          <Route path="/candidates/*" element={<Navigate to="/wren" replace />} />
          <Route path="/roles" element={<Navigate to="/wren" replace />} />
          <Route path="/roles/*" element={<Navigate to="/wren" replace />} />
        </Routes>
        </AgentProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
