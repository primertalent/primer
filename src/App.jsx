import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AgentProvider } from './context/AgentContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import CandidateCard from './pages/CandidateCard'
import Queue from './pages/Queue'
import Roles from './pages/Roles'
import CreateRole from './pages/CreateRole'
import Candidates from './pages/Candidates'
import CreateCandidate from './pages/CreateCandidate'
import RoleDetail from './pages/RoleDetail'
import EditRole from './pages/EditRole'
import EditCandidate from './pages/EditCandidate'
import CallMode from './pages/CallMode'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AgentProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/desk" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/desk" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard" element={<Navigate to="/desk" replace />} />
          <Route path="/network" element={<ProtectedRoute><Candidates /></ProtectedRoute>} />
          <Route path="/network/new" element={<ProtectedRoute><CreateCandidate /></ProtectedRoute>} />
          <Route path="/network/:id" element={<ProtectedRoute><CandidateCard /></ProtectedRoute>} />
          <Route path="/network/:id/edit" element={<ProtectedRoute><EditCandidate /></ProtectedRoute>} />
          <Route path="/network/:id/call" element={<ProtectedRoute><CallMode /></ProtectedRoute>} />
          <Route path="/candidates" element={<Navigate to="/network" replace />} />
          <Route path="/candidates/new" element={<Navigate to="/network/new" replace />} />
          <Route path="/queue" element={<ProtectedRoute><Queue /></ProtectedRoute>} />
          <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
          <Route path="/roles/:id" element={<ProtectedRoute><RoleDetail /></ProtectedRoute>} />
          <Route path="/roles/:id/edit" element={<ProtectedRoute><EditRole /></ProtectedRoute>} />
          <Route path="/roles/new" element={<ProtectedRoute><CreateRole /></ProtectedRoute>} />
        </Routes>
        </AgentProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
