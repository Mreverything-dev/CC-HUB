// frontend/src/features/profile/pages/ProfilePage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import { profileService } from '@/services/api/profile.service';
import { mediaService } from '@/services/api/media.service';
import { postService, Post } from '@/services/api/post.service';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { useChat } from '@/features/chat/hooks/useChat';
import { Button } from '@/components/ui/Button/Button';
import { UserProfileResponse } from '@/types/profile.types';
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
} from '@heroicons/react/24/outline';

// Avatars are images only - keep in sync with backend ALLOWED_TYPES in app/api/v1/endpoints/media.py
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

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
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'info'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
    setIsEditing(false);
    setActiveTab('posts');
  }, [userId]);

  useEffect(() => {
    if (profile) {
      fetchPosts();
    }
  }, [profile?.user_id]);

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
      // Initialize form data with existing profile data
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

      // Create the profile row if this is the user's first save, otherwise update it
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

      // Persist username if changed
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
    e.target.value = ''; // allow re-selecting the same file later
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

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data
    if (profile?.profile) {
      setFormData({
        ...profile.profile,
        username: profile.username,
        email: profile.email,
      });
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
      'w-full px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white placeholder-[#6b6b6b] focus:ring-1 focus:ring-[#00d4ff] focus:border-[#00d4ff] focus:outline-none';

    return (
      <div>
        <label className="block text-sm font-medium text-[#a0a0a0] mb-1">
          {label} {isRequired && <span className="text-red-400">*</span>}
        </label>
        {isEditing ? (
          type === 'textarea' ? (
            <textarea
              value={value}
              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
              rows={3}
              className={inputClassName}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          ) : type === 'select' ? (
            <select
              value={value}
              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
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
              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
              className={inputClassName}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          )
        ) : (
          <p className="mt-1 text-white">
            {value || <span className="text-[#6b6b6b]">Not set</span>}
          </p>
        )}
      </div>
    );
  };

  const renderProfileFields = () => {
    if (!profile) return null;

    // Common fields for all roles
    const commonFields = (
      <>
        <div className="grid grid-cols-2 gap-4">
          {renderField('First Name', 'first_name')}
          {renderField('Last Name', 'last_name')}
        </div>
        {renderField('Username', 'username')}
        {renderField('Email', 'email', 'email')}
        {renderField('Bio', 'bio', 'textarea')}
        {renderField('Contact Number', 'contact_number')}
        {renderField('Address', 'address', 'textarea')}
      </>
    );

    // Role-specific fields
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
            { value: 5, label: '5th Year' },
            { value: 6, label: '6th Year' },
          ])}
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
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d4ff]"></div>
      </div>
    );
  }

  const displayName =
    profile?.profile?.first_name && profile?.profile?.last_name
      ? `${profile.profile.first_name} ${profile.profile.last_name}`
      : profile?.username || 'User';

  const sectionLabel = (profile?.profile as any)?.course || (profile?.profile as any)?.department || null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Subtle grid background, consistent with the dashboards */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className="relative max-w-2xl mx-auto py-8 px-4">
        <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-5">
            {!isOwnProfile ? (
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 -ml-1.5 text-[#a0a0a0] hover:text-white rounded-full hover:bg-white/5 transition"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            ) : (
              <span />
            )}
            <span />
          </div>

          {/* Avatar + identity */}
          <div className="px-6 pt-3 flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-3xl font-bold text-[#0a0a0a] overflow-hidden">
                {profile?.profile?.avatar_url ? (
                  <img
                    src={profile.profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  profile?.username?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
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
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#1a1a1a] shadow-md border border-[#2a2a2a] flex items-center justify-center hover:bg-[#2a2a2a] transition disabled:opacity-50"
                  >
                    {isUploadingAvatar ? (
                      <span className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-[#2a2a2a] border-t-[#00d4ff]" />
                    ) : (
                      <CameraIcon className="h-3.5 w-3.5 text-[#a0a0a0]" />
                    )}
                  </button>
                </>
              )}
            </div>
            <div className="pt-1 min-w-0">
              <h1 className="text-2xl font-bold text-white truncate">{displayName}</h1>
              <p className="text-[#a0a0a0] text-sm mt-0.5">
                {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Student'}
              </p>
              {sectionLabel && <p className="text-[#a0a0a0] text-sm">{sectionLabel}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 px-6 py-5">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{posts.length}</p>
              <p className="text-xs text-[#6b6b6b] mt-0.5">Posts</p>
            </div>
            {isOwnProfile && (
              <>
                <div className="w-px h-8 bg-[#2a2a2a]" />
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{friends.length}</p>
                  <p className="text-xs text-[#6b6b6b] mt-0.5">Friends</p>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-5">
            {isOwnProfile ? (
              isEditing ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1 !border-[#2a2a2a] !text-[#a0a0a0] hover:!text-white hover:!border-[#00d4ff]/50"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdate}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1 !bg-[#00d4ff]/10 !text-[#00d4ff] !shadow-none hover:!bg-[#00d4ff]/20"
                  >
                    <CheckIcon className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center justify-center gap-1 !bg-[#00d4ff]/10 !text-[#00d4ff] !shadow-none hover:!bg-[#00d4ff]/20"
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit Profile
                </Button>
              )
            ) : friendRecord ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleMessage}
                  disabled={isStartingChat}
                  className="flex-1 flex items-center justify-center gap-1 !bg-[#00d4ff]/10 !text-[#00d4ff] !shadow-none hover:!bg-[#00d4ff]/20"
                >
                  <ChatBubbleLeftIcon className="h-4 w-4" />
                  {isStartingChat ? 'Opening...' : 'Message'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRemoveFriend}
                  className="flex-1 flex items-center justify-center gap-1 !border-[#2a2a2a] !text-[#a0a0a0] hover:!text-red-400 hover:!border-red-500/40"
                >
                  <UserMinusIcon className="h-4 w-4" />
                  Remove Friend
                </Button>
              </div>
            ) : receivedRequest ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleAcceptFriendRequest}
                  className="flex-1 flex items-center justify-center gap-1 !bg-[#00d4ff]/10 !text-[#00d4ff] !shadow-none hover:!bg-[#00d4ff]/20"
                >
                  <CheckIcon className="h-4 w-4" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRejectFriendRequest}
                  className="flex-1 flex items-center justify-center gap-1 !border-[#2a2a2a] !text-[#a0a0a0] hover:!text-white hover:!border-[#00d4ff]/50"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            ) : sentRequest ? (
              <Button
                variant="outline"
                onClick={handleCancelFriendRequest}
                className="w-full flex items-center justify-center gap-1 !border-[#2a2a2a] !text-[#a0a0a0] hover:!text-white hover:!border-[#00d4ff]/50"
              >
                <XMarkIcon className="h-4 w-4" />
                Cancel Request
              </Button>
            ) : (
              <Button
                onClick={handleSendFriendRequest}
                disabled={isSendingRequest}
                className="w-full flex items-center justify-center gap-1 !bg-[#00d4ff]/10 !text-[#00d4ff] !shadow-none hover:!bg-[#00d4ff]/20"
              >
                <UserPlusIcon className="h-4 w-4" />
                {isSendingRequest ? 'Sending...' : 'Add Friend'}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center border-t border-[#2a2a2a]">
            {([
              ['posts', 'Posts'],
              ['saved', 'Saved'],
              ['info', 'About'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-3 text-sm font-medium transition border-b-2 ${
                  activeTab === id
                    ? 'text-[#00d4ff] border-[#00d4ff]'
                    : 'text-[#6b6b6b] border-transparent hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-6 space-y-4">
          {activeTab === 'info' ? (
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-6">
              {renderProfileFields()}
            </div>
          ) : activeTab === 'saved' ? (
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-10 text-center">
              <p className="text-[#6b6b6b]">Saved posts are coming soon.</p>
            </div>
          ) : postsLoading ? (
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-10 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d4ff] mx-auto"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-10 text-center">
              <p className="text-[#a0a0a0]">
                {isOwnProfile ? "You haven't posted anything yet." : 'No posts to show.'}
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                {...post}
                onLike={handlePostLike}
                onDelete={handlePostDelete}
                onEdit={handlePostEdit}
                dark
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}