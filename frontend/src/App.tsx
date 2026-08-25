// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './features/auth/pages/Login';
import { Register } from './features/auth/pages/Register';
import ForgotPassword from './features/auth/pages/ForgotPassword';
import VerifyEmail from './features/auth/pages/VerifyEmail';
import ResetPassword from './features/auth/pages/ResetPassword';
import ConfirmPasswordChange from './features/auth/pages/ConfirmPasswordChange';
import { ProtectedRoute } from './components/ProtectedRoute';
import AnnouncementFeed from './features/announcements/components/AnnouncementFeed';
import AnnouncementDetailPage from './features/announcements/components/AnnouncementDetailPage';
import { QueryProvider } from './app/providers/QueryProvider';
import PostsPage from './features/dashboard/pages/PostsPage';
import ProfilePage from '@/features/profile/pages/ProfilePage';
import ChatPage from '@/features/chat/components/ChatPage';
// Import role-specific dashboards
import AdminDashboard from './features/dashboard/pages/AdminDashboard';
import ProfessorDashboard from './features/dashboard/pages/ProfessorDashboard';
import StudentDashboard from './features/dashboard/pages/StudentDashboard';
import FriendsPage from './features/friends/components/FriendsPage';
import { ChatWidget } from './features/chat/components/ChatWidget';
// Import SocketProvider for WebSocket
import { SocketProvider } from './app/providers/SocketProvider';

import LivestreamsPage from '@/features/livestream/components/pages/LivestreamsPage';
import LivePage from '@/features/livestream/components/pages/LivePage';
import { LiveStreamStage } from '@/features/livestream/components/LiveStreamStage';

function App() {
  return (
    <QueryProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            {/* ============================================
                PUBLIC ROUTES
                ============================================ */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/confirm-password-change" element={<ConfirmPasswordChange />} />

            {/* ============================================
                PROFILE ROUTES
                ============================================ */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:userId"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/livestreams" 
              element={
                <ProtectedRoute>
                  <LivestreamsPage />
                </ProtectedRoute>
          } 
          />
          <Route 
              path="/live/:streamId" 
              element={
                <ProtectedRoute>
                  <LivePage />
                </ProtectedRoute>
            } 
          />

            {/* ============================================
                ADMIN ROUTES
                ============================================ */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROFESSOR ROUTES
                ============================================ */}
            <Route
              path="/professor/dashboard"
              element={
                <ProtectedRoute allowedRoles={['professor', 'admin']}>
                  <ProfessorDashboard />
                </ProtectedRoute>
              }
            />

            {/* ============================================
                STUDENT ROUTES
                ============================================ */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRoles={['student', 'professor', 'admin']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* ============================================
                FEATURE ROUTES
                ============================================ */}
            <Route
              path="/announcements"
              element={
                <ProtectedRoute>
                  <AnnouncementFeed />
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements/:announcementId"
              element={
                <ProtectedRoute>
                  <AnnouncementDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/posts"
              element={
                <ProtectedRoute>
                  <PostsPage />
                </ProtectedRoute>
              }
            />
            {/* ✅ Chat Route */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-[#060B12] py-8 px-4">
                    <FriendsPage />
                  </div>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                FALLBACK ROUTES
                ============================================ */}
            <Route path="/dashboard" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <ChatWidget />
          <LiveStreamStage />
        </BrowserRouter>
      </SocketProvider>
    </QueryProvider>
  );
}

export default App;
