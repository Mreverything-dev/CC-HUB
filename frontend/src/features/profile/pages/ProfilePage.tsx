// frontend/src/features/profile/pages/ProfilePage.tsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import { profileService } from '@/services/api/profile.service';
import { mediaService } from '@/services/api/media.service';
import { postService, Post } from '@/services/api/post.service';
import { sectionApi } from '@/services/api/section.service';
import PostDetailModal from '@/features/posts/components/PostDetailModal';
import { PostContentBody } from '@/features/posts/components/PostContentBody';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { useChat } from '@/features/chat/hooks/useChat';
import { UserProfileResponse, StudentProfile } from '@/types/profile.types';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { Sidebar, SidebarSection } from '@/features/dashboard/components/Sidebar';
import { Topbar } from '@/features/dashboard/components/Topbar';
import { ChangePasswordSection } from '@/features/profile/components/ChangePasswordSection';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/formatters';
import { extractYouTubeId } from '@/lib/youtube';
import { useSavedPosts } from '@/features/posts/hooks/useSavedPosts';
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
  FilmIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  ChatBubbleLeftIcon as ChatBubbleLeftIconSolid,
} from '@heroicons/react/24/solid';

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

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

function StatPill({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-center ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition`}
    >
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-white/70">{label}</p>
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
  const [showRemoveFriendConfirm, setShowRemoveFriendConfirm] = useState(false);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'posts' | 'shares' | 'info' | 'security' | 'saved'>('posts');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [shares, setShares] = useState<Post[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [sectionName, setSectionName] = useState<string | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(null);
  const { savedPosts } = useSavedPosts();

  // GIF picker states
  const [showGifUrlInput, setShowGifUrlInput] = useState(false);
  const [isSavingGif, setIsSavingGif] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifSearchLoading, setGifSearchLoading] = useState(false);

  // Avatar menu (Image / Video / GIF)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    profileService
      .getMyProfile()
      .then((res) => setSidebarAvatarUrl((res.data.profile as any)?.avatar_url || null))
      .catch(() => setSidebarAvatarUrl(null));
  }, []);

  useEffect(() => {
    if (!showAvatarMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-avatar-menu]')) return;
      if (avatarMenuRef.current && avatarMenuRef.current.contains(target)) return;
      setShowAvatarMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAvatarMenu]);

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

  useEffect(() => {
    if (!lightboxSrc) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSrc(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [lightboxSrc]);

  // Fetch trending or search GIFs from Giphy
  useEffect(() => {
    if (!showGifUrlInput) return;
    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
    if (!apiKey) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setGifSearchLoading(true);
      try {
        const endpoint = gifSearch.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(gifSearch.trim())}&limit=24&rating=pg-13`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=pg-13`;
        const res = await fetch(endpoint, { signal: controller.signal });
        const data = await res.json();
        setGifResults(
          (data.data || []).map((g: any) => ({
            id: g.id,
            url: g.images?.original?.url || g.images?.fixed_height?.url,
            preview: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url || g.images?.original?.url,
          }))
        );
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('Giphy fetch error:', err);
      } finally {
        setGifSearchLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [gifSearch, showGifUrlInput]);

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

  const handleSelectGif = async (gifUrl: string) => {
    if (!profile) return;
    setIsSavingGif(true);
    try {
      const hasProfile = !!profile.profile;
      if (profile.role === 'student') {
        hasProfile
          ? await profileService.updateStudentProfile({ avatar_url: gifUrl })
          : await profileService.createStudentProfile({ user_id: profile.user_id, avatar_url: gifUrl });
      } else if (profile.role === 'professor') {
        hasProfile
          ? await profileService.updateProfessorProfile({ avatar_url: gifUrl })
          : await profileService.createProfessorProfile({ user_id: profile.user_id, avatar_url: gifUrl });
      } else if (profile.role === 'admin') {
        hasProfile
          ? await profileService.updateAdminProfile({ avatar_url: gifUrl })
          : await profileService.createAdminProfile({ user_id: profile.user_id, avatar_url: gifUrl });
      }
      toast.success('Avatar updated with GIF!');
      setShowGifUrlInput(false);
      setGifSearch('');
      setGifResults([]);
      await fetchProfile();
    } catch (error: any) {
      console.error('Error saving GIF avatar:', error);
      toast.error(error.response?.data?.detail || 'Failed to save GIF avatar');
    } finally {
      setIsSavingGif(false);
    }
  };

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
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Profile link copied to share!');
    }
  };

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
    if (!profile) return;
    setShowRemoveFriendConfirm(true);
  };

  const confirmRemoveFriend = async () => {
    if (!profile) return;
    setIsRemovingFriend(true);
    try {
      await removeFriend(profile.user_id);
      setShowRemoveFriendConfirm(false);
    } finally {
      setIsRemovingFriend(false);
    }
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
      'w-full px-3 py-2 rounded-xl border border-border bg-bg text-sm text-text-primary placeholder-text-muted focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none';

    return (
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
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
          <p className="mt-1 text-text-primary">{value || <span className="text-text-muted">Not set</span>}</p>
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
              <label className="block text-sm font-medium text-text-secondary mb-1">Section</label>
              <p className="mt-1 text-text-primary">{sectionName || <span className="text-text-muted">Not assigned</span>}</p>
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
      <div className="flex items-center justify-center min-h-screen bg-bg">
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

  const isOnline = isOwnProfile ? true : friendRecord ? friendRecord.is_online : null;

  const completion = computeCompletion(profile);
  const coverUrl = (profile?.profile as any)?.cover_url || null;

  return (
    <div className="min-h-screen bg-bg text-text-primary flex">
      <Sidebar activeSection={null} onNavigate={handleSidebarNavigate} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          avatarUrl={sidebarAvatarUrl}
          onNavigateHome={() => handleSidebarNavigate('feed')}
          onOpenFriends={() => handleSidebarNavigate('friends')}
        />

        <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 py-6 lg:px-8">
        {!isOwnProfile && (
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
        )}

        <div className="relative rounded-2xl border border-border shadow-[0_0_40px_rgba(0,200,255,0.05)]">
          {/* Cover — desktop lang */}
          <div className="relative hidden sm:block h-[300px] lg:h-[320px] rounded-2xl overflow-hidden">
            <div
              className={`absolute inset-0 z-0 ${coverUrl ? 'cursor-zoom-in' : ''}`}
              onClick={() => coverUrl && setLightboxSrc(coverUrl)}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover object-center" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#00C8FF]/25 via-bg to-[#3B82F6]/25" />
              )}
            </div>
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/95 via-black/65 to-transparent" />
          </div>

          {/* Avatar + name + stats — mobile at desktop */}
          <div className="relative p-4 sm:absolute sm:inset-x-0 sm:bottom-0 sm:z-20 sm:px-6 lg:px-8 sm:pb-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative flex-shrink-0">
                <div
                  className={`h-20 w-20 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-full ring-4 ring-bg bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center text-2xl font-bold text-[#060B12] overflow-hidden ${
                    profile?.profile?.avatar_url ? 'cursor-zoom-in' : ''
                  }`}
                  onClick={() => profile?.profile?.avatar_url && setLightboxSrc(profile.profile.avatar_url)}
                >
                  {profile?.profile?.avatar_url ? (
                    <img src={profile.profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.username?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                {isOnline !== null && (
                  <span
                    title={isOnline ? 'Online' : 'Offline'}
                    className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full ring-4 ring-bg ${
                      isOnline ? 'bg-[#22C55E]' : 'bg-text-muted'
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
                    <div className="relative" ref={avatarMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowAvatarMenu((v) => !v)}
                        disabled={isUploadingAvatar}
                        title="Change avatar"
                        className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-bg shadow-md border border-border flex items-center justify-center hover:bg-border transition disabled:opacity-50"
                      >
                        {isUploadingAvatar ? (
                          <span className="animate-spin h-3 w-3 rounded-full border-2 border-border border-t-[#00C8FF]" />
                        ) : (
                          <CameraIcon className="h-3 w-3 text-text-secondary" />
                        )}
                      </button>

                      {showAvatarMenu && avatarMenuRef.current && createPortal(
                        <div
                          data-avatar-menu
                          className="fixed w-48 rounded-xl border border-border bg-bg shadow-xl py-1 z-[100]"
                          style={{
                            top: avatarMenuRef.current.getBoundingClientRect().bottom + 8,
                            left: avatarMenuRef.current.getBoundingClientRect().left,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAvatarMenu(false);
                              avatarInputRef.current?.click();
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
                          >
                            <PhotoIcon className="h-4 w-4" />
                            Upload Image
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAvatarMenu(false);
                              toast('Video upload coming soon');
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition opacity-50 cursor-not-allowed"
                          >
                            <FilmIcon className="h-4 w-4" />
                            Upload Video
                            <span className="ml-auto text-[9px] uppercase tracking-wide border border-border rounded px-1">Soon</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAvatarMenu(false);
                              setShowGifUrlInput(true);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
                          >
                            <span className="text-[10px] font-bold border border-border rounded px-1">GIF</span>
                            Use GIF URL
                          </button>
                        </div>,
                        document.body
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex-1 min-w-0 pb-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-text-primary sm:text-white truncate">{displayName}</h1>
                  <RoleBadge role={profile?.role || 'student'} />
                </div>
                <p className="text-xs sm:text-sm text-text-muted sm:text-white/80 mt-0.5">@{profile?.username}</p>
                {(programLabel || sectionName) && (
                  <p className="flex items-center gap-1.5 text-xs sm:text-sm text-text-secondary sm:text-white/90 mt-1">
                    <AcademicCapIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    {[programLabel, sectionName].filter(Boolean).join(' • ')}
                  </p>
                )}
                {bio && (
                  <p className="text-xs sm:text-sm text-text-secondary sm:text-white/80 mt-1 max-w-xl line-clamp-2">
                    {bio}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border sm:border-white/10">
              <StatPill label="Posts" value={posts.length} />
              {isOwnProfile && (
                <StatPill label="Friends" value={friends.length} onClick={() => handleSidebarNavigate('friends')} />
              )}
            </div>
          </div>

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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-xs font-medium text-white hover:bg-black/60 transition disabled:opacity-50"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-xs font-medium text-white hover:bg-black/60 transition disabled:opacity-50"
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
                    className="p-2 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                  {showActionMenu && (
                    <div role="menu" className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-bg shadow-xl py-1">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setIsEditing(true);
                          setActiveTab('info');
                          setShowActionMenu(false);
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
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
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
                      >
                        <PhotoIcon className="h-4 w-4" />
                        Change Cover
                      </button>
                      <button
                        role="menuitem"
                        onClick={handleCopyLink}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Copy Profile Link
                      </button>
                      <button
                        role="menuitem"
                        onClick={handleShareProfile}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
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
                      className="p-2 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-white hover:text-red-400 hover:bg-black/60 transition"
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
                      className="p-2 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </>
                ) : sentRequest ? (
                  <button
                    onClick={handleCancelFriendRequest}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-xs font-medium text-white hover:bg-black/60 transition"
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
                    className="p-2 rounded-xl border border-white/15 bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                  {showActionMenu && (
                    <div role="menu" className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-bg shadow-xl py-1">
                      <button
                        role="menuitem"
                        onClick={handleCopyLink}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Copy Profile Link
                      </button>
                      <button
                        role="menuitem"
                        onClick={handleShareProfile}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
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

        {(bio || programLabel || sectionName) && (
          <div className="sm:hidden mt-3 rounded-xl border border-border bg-glass p-3 space-y-1">
            {(programLabel || sectionName) && (
              <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                <AcademicCapIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {[programLabel, sectionName].filter(Boolean).join(' • ')}
              </p>
            )}
            {bio && <p className="text-xs text-text-secondary">{bio}</p>}
          </div>
        )}

        {isOwnProfile && completion < 100 && (
          <div className="mt-4 rounded-2xl border border-border bg-glass p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative h-12 w-12 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--color-border))" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="rgb(var(--color-text-primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(completion / 100) * 100.5} 100.5`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-text-primary">
                {completion}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <SparklesIcon className="h-4 w-4 text-[#F5B82E]" />
                Almost there!
              </p>
              <p className="text-sm text-text-secondary">Complete your profile so classmates can get to know you.</p>
            </div>
            <button
              onClick={() => {
                setIsEditing(true);
                setActiveTab('info');
              }}
              className="w-full sm:w-auto sm:flex-shrink-0 px-4 py-2 text-sm font-semibold border border-border bg-glass text-text-primary rounded-xl hover:bg-glass-hover transition"
            >
              Complete Profile
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
          <div className="xl:col-span-2 min-w-0">
            <div className="flex items-center gap-1 border-b border-border mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {(
                [
                  ['posts', 'Posts'],
                  ['shares', 'Shares'],
                  isOwnProfile ? ['saved', 'Saved'] : null,
                  ['info', 'About'],
                  isOwnProfile ? ['security', 'Security'] : null,
                ].filter(Boolean) as [typeof activeTab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                    activeTab === id
                      ? 'text-text-primary border-text-primary'
                      : 'text-text-muted border-transparent hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {activeTab === 'security' && isOwnProfile ? (
                <ChangePasswordSection />
              ) : activeTab === 'info' ? (
                <div className="rounded-2xl border border-border bg-glass p-6">{renderProfileFields()}</div>
              ) : activeTab === 'shares' ? (
                sharesLoading ? (
                  <div className="rounded-2xl border border-border bg-glass p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF] mx-auto"></div>
                  </div>
                ) : shares.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-glass p-10 text-center">
                    <p className="text-text-secondary">
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
              ) : activeTab === 'saved' ? (
                savedPosts.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-glass p-10 text-center">
                    <p className="text-text-secondary">
                      You haven't saved any posts yet. Click the "Save" button on a post to save it.
                    </p>
                  </div>
                ) : (
                  savedPosts.map((post) => (
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
                )
              ) : postsLoading ? (
                <div className="rounded-2xl border border-border bg-glass p-10 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C8FF] mx-auto"></div>
                </div>
              ) : posts.length === 0 ? (
                <div className="rounded-2xl border border-border bg-glass p-10 text-center">
                  <p className="text-text-secondary">
                    {isOwnProfile ? "You haven't posted anything yet." : 'No posts to show.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {posts.map((post) => {
                    const ytId = extractYouTubeId(post.content);
                    const thumb = post.media_urls?.[0] ?? (ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : null);
                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => setSelectedPostId(post.id)}
                        className="relative aspect-square overflow-hidden bg-glass border border-border group cursor-pointer"
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.src.includes('maxresdefault')) {
                                img.src = img.src.replace('maxresdefault', 'hqdefault');
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-2 overflow-hidden">
                            <PostContentBody
                              content={post.content || 'No preview'}
                              className="text-[9px] leading-tight text-text-primary text-center line-clamp-6 [&_*]:!text-text-primary"
                            />
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-semibold">
                          <span className="flex items-center gap-1">
                            <HeartIconSolid className="h-4 w-4" />
                            {post.reactions_count ?? post.likes_count ?? 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <ChatBubbleLeftIconSolid className="h-4 w-4" />
                            {post.comments_count ?? 0}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-2xl border border-border bg-glass p-4">
              <h3 className="font-semibold text-text-primary mb-3">About Me</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <EnvelopeIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-text-muted text-xs">Email</dt>
                    <dd className="text-text-primary truncate">{profile?.email}</dd>
                  </div>
                </div>
                {programLabel && (
                  <div className="flex items-start gap-2.5">
                    {profile?.role === 'student' ? (
                      <AcademicCapIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                    ) : (
                      <BuildingLibraryIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <dt className="text-text-muted text-xs">
                        {profile?.role === 'student' ? 'Program' : profile?.role === 'professor' ? 'Department' : 'Position'}
                      </dt>
                      <dd className="text-text-primary truncate">{programLabel}</dd>
                    </div>
                  </div>
                )}
                {sectionName && (
                  <div className="flex items-start gap-2.5">
                    <UserGroupIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-text-muted text-xs">Section</dt>
                      <dd className="text-text-primary truncate">{sectionName}</dd>
                    </div>
                  </div>
                )}
                {(profile?.profile as any)?.contact_number && (
                  <div className="flex items-start gap-2.5">
                    <PhoneIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-text-muted text-xs">Contact</dt>
                      <dd className="text-text-primary truncate">{(profile?.profile as any).contact_number}</dd>
                    </div>
                  </div>
                )}
                {(profile?.profile as any)?.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPinIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-text-muted text-xs">Address</dt>
                      <dd className="text-text-primary truncate">{(profile?.profile as any).address}</dd>
                    </div>
                  </div>
                )}
                {(profile?.profile as any)?.student_id && (
                  <div className="flex items-start gap-2.5">
                    <IdentificationIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-text-muted text-xs">Student ID</dt>
                      <dd className="text-text-primary truncate">{(profile?.profile as any).student_id}</dd>
                    </div>
                  </div>
                )}
                {(profile?.profile as any)?.title && (
                  <div className="flex items-start gap-2.5">
                    <BriefcaseIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-text-muted text-xs">Title</dt>
                      <dd className="text-text-primary truncate">{(profile?.profile as any).title}</dd>
                    </div>
                  </div>
                )}
                {joinedDate && (
                  <div className="flex items-start gap-2.5">
                    <CalendarDaysIcon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <dt className="text-text-muted text-xs">Joined</dt>
                      <dd className="text-text-primary truncate">{joinedDate}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>

            {isOwnProfile && (
              <div className="rounded-2xl border border-border bg-glass p-4">
                <h3 className="font-semibold text-text-primary mb-3">Friends ({friends.length})</h3>
                {friends.length === 0 ? (
                  <p className="text-sm text-text-muted">No friends yet.</p>
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
                        <span className="text-[10px] text-text-secondary truncate w-full text-center">{f.username}</span>
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

      {showRemoveFriendConfirm && (
        <ConfirmDialog
          title="Remove Friend?"
          message={`Are you sure you want to remove ${displayName} from your friends?`}
          confirmLabel="Remove Friend"
          cancelLabel="Cancel"
          isLoading={isRemovingFriend}
          loadingLabel="Removing..."
          onConfirm={confirmRemoveFriend}
          onCancel={() => setShowRemoveFriendConfirm(false)}
        />
      )}

      {selectedPostId && (() => {
        const initialPost = posts.find((p) => p.id === selectedPostId) ?? null;
        return (
          <PostDetailModal
            postId={selectedPostId}
            initialPost={initialPost}
            onClose={() => setSelectedPostId(null)}
            onDelete={(id: string) => {
              handlePostDelete(id);
              setSelectedPostId(null);
            }}
            onEdit={handlePostEdit}
          />
        );
      })()}

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            onClick={() => setLightboxSrc(null)}
            title="Close"
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          <img
            src={lightboxSrc}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* GIF Picker Modal */}
      {showGifUrlInput && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isSavingGif && setShowGifUrlInput(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Choose a GIF avatar"
        >
          <div
            className="bg-bg border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Choose a GIF</h3>
                <p className="text-xs text-text-muted">Search Giphy or pick from trending</p>
              </div>
              <button
                onClick={() => !isSavingGif && setShowGifUrlInput(false)}
                disabled={isSavingGif}
                aria-label="Close"
                className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-glass transition disabled:opacity-50"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Search bar */}
            <div className="px-5 py-3 border-b border-border flex-shrink-0">
              <input
                type="text"
                value={gifSearch}
                onChange={(e) => setGifSearch(e.target.value)}
                placeholder="Search Giphy..."
                autoFocus
                disabled={isSavingGif}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg text-sm text-text-primary placeholder-text-muted focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition disabled:opacity-50"
              />
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto themed-scrollbar p-5">
              {gifSearchLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="animate-spin h-6 w-6 rounded-full border-2 border-border border-t-[#00C8FF]" />
                  <p className="text-xs text-text-muted">Loading GIFs...</p>
                </div>
              ) : gifResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-text-secondary">
                    {gifSearch.trim() ? 'No GIFs found.' : 'No trending GIFs available.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {gifResults.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      onClick={() => handleSelectGif(gif.url)}
                      disabled={isSavingGif}
                      className="relative aspect-square overflow-hidden rounded-lg border border-border bg-glass hover:border-[#00C8FF] transition disabled:opacity-50"
                    >
                      <img src={gif.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0">
              <a
                href="https://giphy.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-muted hover:text-[#00C8FF] transition-colors"
              >
                Powered by GIPHY
              </a>
              <button
                onClick={() => !isSavingGif && setShowGifUrlInput(false)}
                disabled={isSavingGif}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass rounded-xl transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}