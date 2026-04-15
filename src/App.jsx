import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import EditCandidate from './pages/EditCandidate'
import CallMode from './pages/CallMode'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates"
            element={
              <ProtectedRoute>
                <Candidates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates/new"
            element={
              <ProtectedRoute>
                <CreateCandidate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates/:id"
            element={
              <ProtectedRoute>
                <CandidateCard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates/:id/edit"
            element={
              <ProtectedRoute>
                <EditCandidate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates/:id/call"
            element={
              <ProtectedRoute>
                <CallMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/queue"
            element={
              <ProtectedRoute>
                <Queue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients/:id"
            element={
              <ProtectedRoute>
                <ClientDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <ProtectedRoute>
                <Roles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles/:id"
            element={
              <ProtectedRoute>
                <RoleDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles/:id/edit"
            element={
              <ProtectedRoute>
                <EditRole />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles/new"
            element={
              <ProtectedRoute>
                <CreateRole />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
