import { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

const Home = lazy(() => import('@/pages/Home/Home'));
const Login = lazy(() => import('@/features/auth/pages/Login'));
const AdminDashboard = lazy(() => import('@/features/dashboard/pages/AdminDashboard'));
const ProfessorDashboard = lazy(() => import('@/features/dashboard/pages/ProfessorDashboard'));
const StudentDashboard = lazy(() => import('@/features/dashboard/pages/StudentDashboard'));

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/admin/dashboard',
    element: <AdminDashboard />,
  },
  {
    path: '/professor/dashboard',
    element: <ProfessorDashboard />,
  },
  {
    path: '/student/dashboard',
    element: <StudentDashboard />,
  },
];
