// frontend/src/features/profile/components/ProfileAvatar.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileService } from '@/services/api/profile.service';
import { UserProfileResponse } from '@/types/profile.types';
import {
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

export default function ProfileAvatar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await profileService.getMyProfile();
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = () => {
    if (profile?.profile) {
      const p = profile.profile as any;
      const first = p.first_name?.charAt(0) || '';
      const last = p.last_name?.charAt(0) || '';
      return (first + last).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U';
    }
    return user?.username?.charAt(0).toUpperCase() || 'U';
  };

  const getAvatarUrl = () => {
    return (profile?.profile as any)?.avatar_url || null;
  };

  const getFullName = () => {
    if (profile?.profile) {
      const p = profile.profile as any;
      if (p.first_name && p.last_name) {
        return `${p.first_name} ${p.last_name}`;
      }
    }
    return user?.username || 'User';
  };

  const getRoleBadge = () => {
    const role = profile?.role || user?.role || 'student';
    const colors = {
      admin: 'bg-purple-100 text-purple-700',
      professor: 'bg-cyan-100 text-cyan-700',
      student: 'bg-blue-100 text-blue-700',
    };
    return colors[role as keyof typeof colors] || colors.student;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="relative">
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 focus:outline-none group"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:shadow-lg transition-all overflow-hidden">
          {isLoading ? (
            <div className="animate-pulse">...</div>
          ) : getAvatarUrl() ? (
            <img src={getAvatarUrl()} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            getInitials()
          )}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">
            {isLoading ? 'Loading...' : getFullName()}
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadge()}`}>
            {profile?.role || user?.role || 'Student'}
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-base overflow-hidden">
                  {getAvatarUrl() ? (
                    <img src={getAvatarUrl()} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {getFullName()}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadge()} inline-block mt-1`}>
                    {profile?.role || user?.role || 'Student'}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <UserCircleIcon className="h-5 w-5 text-gray-400" />
                My Profile
              </Link>
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <Cog6ToothIcon className="h-5 w-5 text-gray-400" />
                Settings
              </Link>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100"></div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 text-red-400" />
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
}