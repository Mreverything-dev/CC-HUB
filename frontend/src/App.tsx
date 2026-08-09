// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './features/auth/pages/Login';
import { Register } from './features/auth/pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import AnnouncementFeed from './features/announcements/components/AnnouncementFeed';
import { QueryProvider } from './app/providers/QueryProvider';

// Import role-specific dashboards from the correct paths
import AdminDashboard from './features/dashboard/pages/AdminDashboard';
import ProfessorDashboard from './features/dashboard/pages/ProfessorDashboard';
import StudentDashboard from './features/dashboard/pages/StudentDashboard';

function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Admin Routes */}
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Professor Routes */}
          <Route 
            path="/professor/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['professor', 'admin']}>
                <ProfessorDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Student Routes */}
          <Route 
            path="/student/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['student', 'professor', 'admin']}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Announcements Route - accessible to all authenticated users */}
          <Route 
            path="/announcements" 
            element={
              <ProtectedRoute>
                <AnnouncementFeed />
              </ProtectedRoute>
            } 
          />
          
          {/* Fallback - redirect to student dashboard */}
          <Route path="/dashboard" element={<Navigate to="/student/dashboard" replace />} />
          
          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}

export default App;