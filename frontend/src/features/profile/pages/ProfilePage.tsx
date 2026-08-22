// frontend/src/features/profile/pages/ProfilePage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import { profileService } from '@/services/api/profile.service';
import { mediaService } from '@/services/api/media.service';
import { postService, Post } from '@/services/api/post.service';
import { sectionApi } from '@/services/api/section.service';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { useChat } from '@/features/chat/hooks/useChat';
import { UserProfileResponse, StudentProfile } from '@/types/profile.types';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { Sidebar, SidebarSection } from '@/features/dashboard/components/Sidebar';
import { Topbar } from '@/features/dashboard/components/Topbar';
import { formatDate } from '@/lib/formatters';
import toast from 'react-hot-toast';
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  CameraIcon,
  ArrowLeftIcon,
  UserPlusIcon,
  UserMinusIcon,
  ChatBubbleLeftIcon,
  EllipsisVerticalIcon,
  LinkIcon,
  ShareIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  IdentificationIcon,
  BriefcaseIcon,
  UserGroupIcon,
  BuildingLibraryIcon,
  SparklesIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

// Avatars/covers are images only - keep in sync with backend ALLOWED_TYPES in app/api/v1/endpoints/media.py
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

// Only counts fields that actually exist on the backend profile models - never
// fabricates progress for data (badges, groups, birthday, etc.) that isn't tracked.
function computeCompletion(profile: UserProfileResponse | null): number {
  const p = profile?.profile as any;
  if (!profile || !p) return 0;
  let fields: any[];
  if (profile.role === 'student') {
    fields = [p.first_name, p.last_name, p.avatar_url, p.bio, p.contact_number, p.address, p.student_id, p.course, p.year_level];
  } else if (profile.role === 'professor') {
    fields = [p.first_name, p.last_name, p.avatar_url, p.bio, p.contact_number, p.office, p.employee_id, p.department, p.title];
  } else {
    fields = [p.first_name, p.last_name, p.avatar_url, p.contact_number, p.position];
  }
  const filled = fields.filter((v) => v !== null && v !== undefined && v !== '').length;
  return Math.round((filled / fields.length) * 100);
}

const gridBg = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

function StatPill({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-center ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition`}
    >
      <p className="text-lg font-bold text-[#F1F5F9]">{value}</p>
      <p className="text-xs text-[#64748B]">{label}</p>
    </button>
  );
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const isOwnProfile = !userId || userId === user?.id;
  const {
    friends,
    friendRequests,
    sendFriendRequest,
    respondToFriendRequest,
    cancelFriendRequest,
    removeFriend,
  } = useFriends();
  const { createDirectConversation, openWidget } = useChat();
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'posts' | 'shares' | 'saved' | 'info'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [shares, setShares] = useState<Post[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [sectionName, setSectionName] = useState<string | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionMenuButtonRef = useRef<HTMLButtonElement>(null);

  // The Sidebar/Topbar always reflect the *current logged-in user*, distinct
  // from `profile` above which may belong to whoever's page is being viewed.
  useEffect(() => {
    profileService
      .getMyProfile()
      .then((res) => setSidebarAvatarUrl((res.data.profile as any)?.avatar_url || null))
      .catch(() => setSidebarAvatarUrl(null));
  }, []);

  // Profile isn't one of the dashboard's in-page sections, so nothing in the
  // sidebar renders as "active" here. Clicking a nav item takes the user back
  // to their role's dashboard and deep-links into that section via router state.
  const dashboardPath =
    user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'professor' ? '/professor/dashboard' : '/student/dashboard';
  const handleSidebarNavigate = (section: SidebarSection) => navigate(dashboardPath, { state: { section } });

  useEffect(() => {
    fetchProfile();
    setIsEditing(false);
    setActiveTab('posts');
  }, [userId]);

  useEffect(() => {
    if (profile) {
      fetchPosts();
      fetchShares();
    }
  }, [profile?.user_id]);

  // Resolve the student's section name for display - the profile only stores
  // section_id, so reuse the existing generic GET /sections/{id} endpoint
  // (open to any authenticated user, same approach used by SectionDashboard).
  useEffect(() => {
    const sectionId = (profile?.profile as StudentProfile | undefined)?.section_id;
    if (!sectionId) {
      setSectionName(null);
      return;
    }
    sectionApi
      .getSection(sectionId)
      .then((res) => setSectionName(res.data.name))
      .catch(() => setSectionName(null));
  }, [profile]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowActionMenu(false);
        actionMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const fetchPosts = async () => {
    if (!profile) return;
    setPostsLoading(true);
    try {
      const response = await postService.getUserPosts(profile.user_id);
      setPosts(response.data.items);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchShares = async () => {
    if (!profile) return;
    setSharesLoading(true);
    try {
      const response = await postService.getUserShares(profile.user_id);
      setShares(response.data.items);
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      setSharesLoading(false);
    }
  };

  const handleShareReact = async (postId: string, reaction: string) => {
    const previous = shares.find((p) => p.id === postId);
    try {
      const response = await postService.reactToPost(postId, reaction);
      setShares((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, my_reaction: response.data.reaction, reaction_breakdown: response.data.reaction_breakdown, reactions_count: response.data.reactions_count }
            : p
        )
      );
    } catch (error) {
      console.error('Error reacting to post:', error);
      if (previous) setShares((prev) => prev.map((p) => (p.id === postId ? previous : p)));
    }
  };

  const handlePostLike = async (postId: string) => {
    try {
      await postService.likePost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked_by_current_user: !p.is_liked_by_current_user,
                likes_count: p.is_liked_by_current_user ? p.likes_count - 1 : p.likes_count + 1,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handlePostReact = async (postId: string, reaction: string) => {
    const previous = posts.find((p) => p.id === postId);
    try {
      const response = await postService.reactToPost(postId, reaction);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                my_reaction: response.data.reaction,
                reaction_breakdown: response.data.reaction_breakdown,
                reactions_count: response.data.reactions_count,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Error reacting to post:', error);
      if (previous) setPosts((prev) => prev.map((p) => (p.id === postId ? previous : p)));
    }
  };

  const handlePostDelete = async (postId: string) => {
    try {
      await postService.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success('Post deleted successfully');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handlePostEdit = async (postId: string, content: string) => {
    try {
      await postService.updatePost(postId, content);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, content, updated_at: new Date().toISOString() } : p))
      );
      toast.success('Post updated successfully');
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    }
  };

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const response = isOwnProfile
        ? await profileService.getMyProfile()
        : await profileService.getUserProfile(userId!);
      setProfile(response.data);
      if (response.data.profile) {
        setFormData({
          ...response.data.profile,
          username: response.data.username,
          email: response.data.email,
        });
      } else {
        setFormData({
          username: response.data.username,
          email: response.data.email,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      if (!profile) return;

      const hasProfile = !!profile.profile;

      if (profile.role === 'student') {
        if (hasProfile) {
          await profileService.updateStudentProfile(formData);
        } else {
          await profileService.createStudentProfile({ ...formData, user_id: profile.user_id });
        }
      } else if (profile.role === 'professor') {
        if (hasProfile) {
          await profileService.updateProfessorProfile(formData);
        } else {
          await profileService.createProfessorProfile({ ...formData, user_id: profile.user_id });
        }
      } else if (profile.role === 'admin') {
        if (hasProfile) {
          await profileService.updateAdminProfile(formData);
        } else {
          await profileService.createAdminProfile({ ...formData, user_id: profile.user_id });
        }
      }

      if (formData.username && formData.username !== profile.username) {
        await authApi.updateUsername(formData.username);
        updateUser({ username: formData.username });
      }

      toast.success('Profile updated successfully!');
      setIsEditing(false);
      await fetchProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Please choose a JPEG, PNG, GIF, WEBP, or SVG image.');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const { urls } = await mediaService.uploadFiles([file]);
      const avatarUrl = urls[0];
      const hasProfile = !!profile.profile;

      if (profile.role === 'student') {
        hasProfile
          ? await profileService.updateStudentProfile({ avatar_url: avatarUrl })
          : await profileService.createStudentProfile({ user_id: profile.user_id, avatar_url: avatarUrl });
      } else if (profile.role === 'professor') {
        hasProfile
          ? await profileService.updateProfessorProfile({ avatar_url: avatarUrl })
          : await profileService.createProfessorProfile({ user_id: profile.user_id, avatar_url: avatarUrl });
      } else if (profile.role === 'admin') {
        hasProfile
          ? await profileService.updateAdminProfile({ avatar_url: avatarUrl })
          : await profileService.createAdminProfile({ user_id: profile.user_id, avatar_url: avatarUrl });
      }

      toast.success('Avatar updated!');
      await fetchProfile();
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Mirrors handleAvatarChange exactly - same upload endpoint and same
  // per-role create-or-update pattern, just targeting cover_url instead.
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Please choose a JPEG, PNG, GIF, WEBP, or SVG image.');
      return;
    }

    setIsUploadingCover(true);
    try {
      const { urls } = await mediaService.uploadFiles([file]);
      const coverUrl = urls[0];
      const hasProfile = !!profile.profile;

      if (profile.role === 'student') {
        hasProfile
          ? await profileService.updateStudentProfile({ cover_url: coverUrl })
          : await profileService.createStudentProfile({ user_id: profile.user_id, cover_url: coverUrl });
      } else if (profile.role === 'professor') {
        hasProfile
          ? await profileService.updateProfessorProfile({ cover_url: coverUrl })
          : await profileService.createProfessorProfile({ user_id: profile.user_id, cover_url: coverUrl });
      } else if (profile.role === 'admin') {
        hasProfile
          ? await profileService.updateAdminProfile({ cover_url: coverUrl })
          : await profileService.createAdminProfile({ user_id: profile.user_id, cover_url: coverUrl });
      }

      toast.success('Cover photo updated!');
      await fetchProfile();
    } catch (error: any) {
      console.error('Error uploading cover photo:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload cover photo');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile?.profile) {
      setFormData({
        ...profile.profile,
        username: profile.username,
        email: profile.email,
      });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Profile link copied!');
    setShowActionMenu(false);
  };

  const handleShareProfile = async () => {
    setShowActionMenu(false);
    const shareData = {
      title: `${profile?.username || 'CCS HUB'} on CCS HUB`,
      text: `Check out ${profile?.username || 'this'}'s profile on CCS HUB`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled the native share sheet - no action needed.
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Profile link copied to share!');
    }
  };

  // Friendship status relative to the profile being viewed
  const friendRecord = profile ? friends.find((f) => f.user_id === profile.user_id) : undefined;
  const sentRequest = profile
    ? friendRequests.sent.find((r) => r.receiver_id === profile.user_id && r.status === 'pending')
    : undefined;
  const receivedRequest = profile
    ? friendRequests.received.find((r) => r.sender_id === profile.user_id && r.status === 'pending')
    : undefined;

  const handleSendFriendRequest = async () => {
    if (!profile) return;
    setIsSendingRequest(true);
    try {
      await sendFriendRequest({ receiver_id: profile.user_id });
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptFriendRequest = () => {
    if (!receivedRequest) return;
    respondToFriendRequest({ requestId: receivedRequest.id, data: { status: 'accepted' } });
  };

  const handleRejectFriendRequest = () => {
    if (!receivedRequest) return;
    respondToFriendRequest({ requestId: receivedRequest.id, data: { status: 'rejected' } });
  };

  const handleCancelFriendRequest = () => {
    if (!sentRequest) return;
    cancelFriendRequest(sentRequest.id);
  };

  const handleRemoveFriend = () => {
    if (!profile || !confirm('Remove this friend?')) return;
    removeFriend(profile.user_id);
  };

  const handleMessage = async () => {
    if (!profile) return;
    setIsStartingChat(true);
    try {
      await createDirectConversation(profile.user_id);
      openWidget();
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start conversation');
    } finally {
      setIsStartingChat(false);
    }
  };

  const renderField = (label: string, field: string, type: string = 'text', options?: any[]) => {
    const value = formData[field] || '';
    const isRequired = field === 'first_name' || field === 'last_name';
    const inputClassName =
      'w-full px-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none';

    return (
      <div>
        <label className="block text-sm font-medium text-[#94A3B8] mb-1">
          {label} {isRequired && <span className="text-red-400">*</span>}
        </label>
        {isEditing ? (
          type === 'textarea' ? (
            <textarea
              value={value}
              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
              rows={3}
              className={inputClassName}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          ) : type === 'select' ? (
            <select
              value={value}
              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
              className={inputClassName}
            >
              <option value="">Select {label}</option>
              {options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={value}
              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
              className={inputClassName}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          )
        ) : (
          <p className="mt-1 text-[#F1F5F9]">{value || <span className="text-[#64748B]">Not set</span>}</p>
        )}
      </div>
    );
  };

  const renderProfileFields = () => {
    if (!profile) return null;

    const commonFields = (
      <>
        <div className="grid grid-cols-2 gap-4">
          {renderField('First Name', 'first_name')}
          {renderField('Last Name', 'last_name')}
        </div>
        {renderField('Username', 'username')}
        {renderField('Email', 'email', 'email')}
        {profile.role !== 'admin' && renderField('Bio', 'bio', 'textarea')}
        {renderField('Contact Number', 'contact_number')}
        {profile.role === 'student' && renderField('Address', 'address', 'textarea')}
      </>
    );

    if (profile.role === 'student') {
      return (
        <div className="space-y-4">
          {commonFields}
          <div className="grid grid-cols-2 gap-4">
            {renderField('Student ID', 'student_id')}
            {renderField('Course', 'course')}
          </div>
          {renderField('Year Level', 'year_level', 'select', [
            { value: 1, label: '1st Year' },
            { value: 2, label: '2nd Year' },
            { value: 3, label: '3rd Year' },
            { value: 4, label: '4th Year' },
          ])}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1">Section</label>
              <p className="mt-1 text-[#F1F5F9]">{sectionName || <span className="text-[#64748B]">Not assigned</span>}</p>
            </div>
          )}
        </div>
      );
    }

    if (profile.role === 'professor') {
      return (
        <div className="space-y-4">
          {commonFields}
          <div className="grid grid-cols-2 gap-4">
            {renderField('Employee ID', 'employee_id')}
            {renderField('Department', 'department')}
          </div>
          {renderField('Title', 'title')}
          {renderField('Office', 'office')}
        </div>
      );
    }

    if (profile.role === 'admin') {
      return (
        <div className="space-y-4">
          {commonFields}
          {renderField('Position', 'position')}
        </div>
      );
    }

    return <p>No profile fields available</p>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060B12]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF]"></div>
      </div>
    );
  }

  const displayName =
    profile?.profile?.first_name && profile?.profile?.last_name
      ? `${profile.profile.first_name} ${profile.profile.last_name}`
      : profile?.username || 'User';

  const programLabel =
    (profile?.profile as any)?.course ||
    (profile?.profile as any)?.department ||
    (profile?.profile as any)?.position ||
    null;

  const bio = (profile?.profile as any)?.bio || null;
  const joinedDate = profile?.profile?.created_at ? formatDate(profile.profile.created_at) : null;

  // Only surface an online indicator when we actually have real presence data:
  // it's always true for your own profile, and known for friends (Friends
  // feature tracks is_online). Otherwise omit the dot rather than guess.
  const isOnline = isOwnProfile ? true : friendRecord ? friendRecord.is_online : null;

  const completion = computeCompletion(profile);
  const coverUrl = (profile?.profile as any)?.cover_url || null;

  return (
    <div className="min-h-screen bg-[#060B12] text-[#F1F5F9] flex">
      <div className="pointer-events-none fixed inset-0 opacity-[0.15]" style={gridBg} />

      <Sidebar activeSection={null} onNavigate={handleSidebarNavigate} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar avatarUrl={sidebarAvatarUrl} onOpenFriends={() => handleSidebarNavigate('friends')} />

        <main className="relative flex-1 max-w-6xl w-full mx-auto px-4 py-6 lg:px-8">
        {!isOwnProfile && (
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
        )}

        {/* Header - one compact hero. Cover, gradient, and all profile info
            live in a single overflow-hidden box (no separate section below
            it), so there's no gap between the photo and the profile content. */}
        <div className="relative rounded-2xl border border-[#1E3447] shadow-[0_0_40px_rgba(0,200,255,0.05)]">
          <div className="relative h-[260px] sm:h-[300px] lg:h-[320px] rounded-2xl overflow-hidden">
            {/* Cover image */}
            <div className="absolute inset-0 z-0">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover object-center" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#00C8FF]/25 via-[#0D1722] to-[#3B82F6]/25">
                  <div className="absolute inset-0 opacity-40" style={gridBg} />
                </div>
              )}
            </div>

            {/* Dark readability gradient - transparent at top, dark charcoal/navy
                at bottom, never fully opaque so the cover stays visible. */}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#071019]/95 via-[#071019]/65 to-transparent" />

            {/* Profile information - layered on top of the cover */}
            <div className="absolute inset-x-0 bottom-0 z-20 px-4 sm:px-6 lg:px-8 pb-3 sm:pb-4">
              <div className="flex items-end gap-3 sm:gap-4 min-w-0">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-full ring-4 ring-[#0D1722] bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center text-2xl font-bold text-[#060B12] overflow-hidden">
                    {profile?.profile?.avatar_url ? (
                      <img src={profile.profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      profile?.username?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  {isOnline !== null && (
                    <span
                      title={isOnline ? 'Online' : 'Offline'}
                      className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full ring-4 ring-[#0D1722] ${
                        isOnline ? 'bg-[#22C55E]' : 'bg-[#64748B]'
                      }`}
                    />
                  )}
                  {isOwnProfile && (
                    <>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept={ALLOWED_AVATAR_TYPES.join(',')}
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        title="Change avatar"
                        className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#111E2B] shadow-md border border-[#1E3447] flex items-center justify-center hover:bg-[#1E3447] transition disabled:opacity-50"
                      >
                        {isUploadingAvatar ? (
                          <span className="animate-spin h-3 w-3 rounded-full border-2 border-[#1E3447] border-t-[#00C8FF]" />
                        ) : (
                          <CameraIcon className="h-3 w-3 text-[#94A3B8]" />
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Identity */}
                <div className="flex-1 min-w-0 pb-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">{displayName}</h1>
                    <RoleBadge role={profile?.role || 'student'} />
                  </div>
                  <p className="text-xs sm:text-sm text-[#CBD5E1]/80 mt-0.5">@{profile?.username}</p>
                  {(programLabel || sectionName) && (
                    <p className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm text-[#CBD5E1]/90 mt-1">
                      <AcademicCapIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      {[programLabel, sectionName].filter(Boolean).join(' • ')}
                    </p>
                  )}
                  {bio && (
                    <p className="hidden sm:block text-xs sm:text-sm text-[#CBD5E1]/80 mt-1 max-w-xl line-clamp-2">
                      {bio}
                    </p>
                  )}
                </div>
              </div>

              {/* Compact stats, still inside the hero */}
              <div className="flex items-center gap-5 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-white/10">
                <StatPill label="Posts" value={posts.length} />
                {isOwnProfile && <StatPill label="Friends" value={friends.length} onClick={() => navigate('/')} />}
              </div>
            </div>
          </div>

          {/* Controls - kept outside the clipped hero so an open menu never
              gets cut off by the hero's fixed height / overflow-hidden. */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
            {isOwnProfile && !isEditing && (
              <>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept={ALLOWED_AVATAR_TYPES.join(',')}
                  onChange={handleCoverChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                  title={coverUrl ? 'Change cover photo' : 'Add cover photo'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-xs font-medium text-[#F1F5F9] hover:bg-black/60 transition disabled:opacity-50"
                >
                  {isUploadingCover ? (
                    <span className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <PhotoIcon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{coverUrl ? 'Change Cover' : 'Add Cover'}</span>
                </button>
              </>
            )}

            {isOwnProfile ? (
              isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-xs font-medium text-[#F1F5F9] hover:bg-black/60 transition disabled:opacity-50"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00C8FF] text-[#060B12] text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <div className="relative" ref={actionMenuRef}>
                  <button
                    ref={actionMenuButtonRef}
                    onClick={() => setShowActionMenu((v) => !v)}
                    title="Profile actions"
                    aria-haspopup="menu"
                    aria-expanded={showActionMenu}
                    className="p-2 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-[#F1F5F9] hover:bg-black/60 transition"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                  {showActionMenu && (
                    <div role="menu" className="absolute right-0 mt-2 w-52 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl py-1">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setIsEditing(true);
                          setActiveTab('info');
                          setShowActionMenu(false);
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit Profile
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setShowActionMenu(false);
                          coverInputRef.current?.click();
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
                      >
                        <PhotoIcon className="h-4 w-4" />
                        Change Cover
                      </button>
                      <button
                        role="menuitem"
                        onClick={handleCopyLink}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Copy Profile Link
                      </button>
                      <button
                        role="menuitem"
                        onClick={handleShareProfile}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
                      >
                        <ShareIcon className="h-4 w-4" />
                        Share Profile
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <>
                {friendRecord ? (
                  <>
                    <button
                      onClick={handleMessage}
                      disabled={isStartingChat}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00C8FF] text-[#060B12] text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      <ChatBubbleLeftIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">{isStartingChat ? 'Opening...' : 'Message'}</span>
                    </button>
                    <button
                      onClick={handleRemoveFriend}
                      title="Remove friend"
                      className="p-2 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-[#F1F5F9] hover:text-red-400 hover:bg-black/60 transition"
                    >
                      <UserMinusIcon className="h-4 w-4" />
                    </button>
                  </>
                ) : receivedRequest ? (
                  <>
                    <button
                      onClick={handleAcceptFriendRequest}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00C8FF] text-[#060B12] text-xs font-semibold hover:opacity-90 transition"
                    >
                      <CheckIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Accept</span>
                    </button>
                    <button
                      onClick={handleRejectFriendRequest}
                      title="Reject"
                      className="p-2 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-[#F1F5F9] hover:bg-black/60 transition"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </>
                ) : sentRequest ? (
                  <button
                    onClick={handleCancelFriendRequest}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-xs font-medium text-[#F1F5F9] hover:bg-black/60 transition"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Cancel Request</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSendFriendRequest}
                    disabled={isSendingRequest}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00C8FF] text-[#060B12] text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{isSendingRequest ? 'Sending...' : 'Add Friend'}</span>
                  </button>
                )}
                <div className="relative" ref={actionMenuRef}>
                  <button
                    ref={actionMenuButtonRef}
                    onClick={() => setShowActionMenu((v) => !v)}
                    title="Profile actions"
                    aria-haspopup="menu"
                    aria-expanded={showActionMenu}
                    className="p-2 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-[#F1F5F9] hover:bg-black/60 transition"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                  {showActionMenu && (
                    <div role="menu" className="absolute right-0 mt-2 w-52 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl py-1">
                      <button
                        role="menuitem"
                        onClick={handleCopyLink}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Copy Profile Link
                      </button>
                      <button
                        role="menuitem"
                        onClick={handleShareProfile}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
                      >
                        <ShareIcon className="h-4 w-4" />
                        Share Profile
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bio/program on mobile, where they're hidden in the compact hero to
            keep it from overflowing - shown here instead, right under the header. */}
        {(bio || programLabel || sectionName) && (
          <div className="sm:hidden mt-3 rounded-xl border border-[#1E3447] bg-[#0D1722] p-3 space-y-1">
            {(programLabel || sectionName) && (
              <p className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                <AcademicCapIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {[programLabel, sectionName].filter(Boolean).join(' • ')}
              </p>
            )}
            {bio && <p className="text-xs text-[#CBD5E1]">{bio}</p>}
          </div>
        )}

        {/* Profile completion widget - own profile only, computed from real fields */}
        {isOwnProfile && completion < 100 && (
          <div className="mt-4 rounded-2xl border border-[#00C8FF]/20 bg-[#0D1722] p-4 flex items-center gap-4">
            <div className="relative h-12 w-12 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#1E3447" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#00C8FF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(completion / 100) * 100.5} 100.5`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#00C8FF]">
                {completion}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#F1F5F9] flex items-center gap-1.5">
                <SparklesIcon className="h-4 w-4 text-[#F5B82E]" />
                Almost there!
              </p>
              <p className="text-sm text-[#94A3B8]">Complete your profile so classmates can get to know you.</p>
            </div>
            <button
              onClick={() => {
                setIsEditing(true);
                setActiveTab('info');
              }}
              className="flex-shrink-0 px-4 py-2 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition"
            >
              Complete Profile
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
          <div className="xl:col-span-2 min-w-0">
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[#1E3447] mb-4">
              {([
                ['posts', 'Posts'],
                ['shares', 'Shares'],
                ['saved', 'Saved'],
                ['info', 'About'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                    activeTab === id
                      ? 'text-[#00C8FF] border-[#00C8FF]'
                      : 'text-[#64748B] border-transparent hover:text-[#F1F5F9]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {activeTab === 'info' ? (
                <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-6">{renderProfileFields()}</div>
              ) : activeTab === 'saved' ? (
                <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-10 text-center">
                  <p className="text-[#64748B]">Saved posts are coming soon.</p>
                </div>
              ) : activeTab === 'shares' ? (
                sharesLoading ? (
                  <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF] mx-auto"></div>
                  </div>
                ) : shares.length === 0 ? (
                  <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-10 text-center">
                    <p className="text-[#94A3B8]">
                      {isOwnProfile ? "You haven't shared anything yet." : 'No shared posts to show.'}
                    </p>
                  </div>
                ) : (
                  shares.map((post) => (
                    <PostCard
                      key={post.id}
                      {...post}
                      onLike={handlePostLike}
                      onReact={handleShareReact}
                      onDelete={handlePostDelete}
                      onEdit={handlePostEdit}
                      dark
                    />
                  ))
                )
              ) : postsLoading ? (
                <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-10 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF] mx-auto"></div>
                </div>
              ) : posts.length === 0 ? (
                <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-10 text-center">
                  <p className="text-[#94A3B8]">
                    {isOwnProfile ? "You haven't posted anything yet." : 'No posts to show.'}
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    {...post}
                    onLike={handlePostLike}
                    onReact={handlePostReact}
                    onDelete={handlePostDelete}
                    onEdit={handlePostEdit}
                    dark
                  />
                ))
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            {/* About Me */}
            <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-4">
              <h3 className="font-semibold text-[#F1F5F9] mb-3">About Me</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <EnvelopeIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-[#64748B] text-xs">Email</dt>
                    <dd className="text-[#F1F5F9] truncate">{profile?.email}</dd>
                  </div>
                </div>
                {programLabel && (
                  <div className="flex items-start gap-2.5">
                    {profile?.role === 'student' ? (
                      <AcademicCapIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    ) : (
                      <BuildingLibraryIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <dt className="text-[#64748B] text-xs">
                        {profile?.role === 'student' ? 'Program' : profile?.role === 'professor' ? 'Department' : 'Position'}
                      </dt>
                      <dd className="text-[#F1F5F9] truncate">{programLabel}</dd>
                    </div>
                  </div>
                )}
                {sectionName && (
                  <div className="flex items-start gap-2.5">
                    <UserGroupIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-[#64748B] text-xs">Section</dt>
                      <dd className="text-[#F1F5F9] truncate">{sectionName}</dd>
                    </div>
                  </div>
                )}
                {(profile?.profile as any)?.contact_number && (
                  <div className="flex items-start gap-2.5">
                    <PhoneIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-[#64748B] text-xs">Contact</dt>
                      <dd className="text-[#F1F5F9] truncate">{(profile?.profile as any).contact_number}</dd>
                    </div>
                  </div>
                )}
                {(profile?.profile as any)?.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPinIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-[#64748B] text-xs">Address</dt>
                      <dd className="text-[#F1F5F9] truncate">{(profile?.profile as any).address}</dd>
                    </div>
                  </div>
                )}
                {(profile?.profile as any)?.student_id && (
                  <div className="flex items-start gap-2.5">
                    <IdentificationIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-[#64748B] text-xs">Student ID</dt>
                      <dd className="text-[#F1F5F9] truncate">{(profile?.profile as any).student_id}</dd>
                    </div>
                  </div>
                )}
                {(profile?.profile as any)?.title && (
                  <div className="flex items-start gap-2.5">
                    <BriefcaseIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-[#64748B] text-xs">Title</dt>
                      <dd className="text-[#F1F5F9] truncate">{(profile?.profile as any).title}</dd>
                    </div>
                  </div>
                )}
                {joinedDate && (
                  <div className="flex items-start gap-2.5">
                    <CalendarDaysIcon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-[#64748B] text-xs">Joined</dt>
                      <dd className="text-[#F1F5F9] truncate">{joinedDate}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>

            {/* Friends preview - only meaningful for your own profile, since
                there's no endpoint to view another user's friends list. */}
            {isOwnProfile && (
              <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-4">
                <h3 className="font-semibold text-[#F1F5F9] mb-3">Friends ({friends.length})</h3>
                {friends.length === 0 ? (
                  <p className="text-sm text-[#64748B]">No friends yet.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {friends.slice(0, 8).map((f) => (
                      <button
                        key={f.user_id}
                        onClick={() => navigate(`/profile/${f.user_id}`)}
                        title={f.username}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <Avatar src={f.avatar} name={f.username} size="md" className="group-hover:ring-2 group-hover:ring-[#00C8FF]/50 transition" />
                        <span className="text-[10px] text-[#94A3B8] truncate w-full text-center">{f.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}
