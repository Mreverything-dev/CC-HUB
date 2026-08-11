// frontend/src/features/friends/components/FriendsPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriends } from '../hooks/useFriends';
import { useUsers } from '@/features/users/hooks/useUsers';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import {
  UserPlusIcon,
  UserMinusIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

export default function FriendsPage() {
  const navigate = useNavigate();
  const {
    friends,
    friendRequests,
    isLoading,
    sendFriendRequest,
    respondToFriendRequest,
    cancelFriendRequest,
    removeFriend,
  } = useFriends();
  const { users, isLoading: isSearching, searchUsers } = useUsers();

  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'find'>('friends');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const received = friendRequests.received;
  const sent = friendRequests.sent;

  const friendIds = new Set(friends.map((f) => f.user_id));
  const pendingSentIds = new Set(sent.map((r) => r.receiver_id));
  const searchResults = users.filter(
    (u) => !friendIds.has(u.id) && !pendingSentIds.has(u.id)
  );

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    searchUsers(value);
  };

  const handleSendRequest = async (receiverId: string) => {
    setSendingTo(receiverId);
    try {
      await sendFriendRequest({ receiver_id: receiverId });
    } finally {
      setSendingTo(null);
    }
  };

  const handleAccept = (requestId: string) => {
    respondToFriendRequest({ requestId, data: { status: 'accepted' } });
  };

  const handleReject = (requestId: string) => {
    respondToFriendRequest({ requestId, data: { status: 'rejected' } });
  };

  const handleCancel = (requestId: string) => {
    cancelFriendRequest(requestId);
  };

  const handleRemoveFriend = (friendId: string) => {
    if (confirm('Remove this friend?')) {
      removeFriend(friendId);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Friends</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 font-medium transition flex items-center gap-2 ${
            activeTab === 'friends'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Friends
          {friends.length > 0 && (
            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
              {friends.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium transition flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Requests
          {received.length > 0 && (
            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
              {received.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('find')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'find'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Find People
        </button>
      </div>

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : friends.length === 0 ? (
            <Card variant="glass" className="text-center py-8">
              <p className="text-gray-500">No friends yet.</p>
              <button
                onClick={() => setActiveTab('find')}
                className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                Find people to connect with
              </button>
            </Card>
          ) : (
            friends.map((friend) => (
              <Card key={friend.id} variant="glass" className="flex items-center justify-between p-4">
                <div
                  onClick={() => navigate(`/profile/${friend.user_id}`)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {friend.avatar ? (
                      <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-600 font-semibold">
                        {friend.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 hover:underline">{friend.username}</p>
                    <p className="text-sm text-gray-500">{friend.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFriend(friend.user_id)}
                  title="Remove friend"
                  className="p-2 text-gray-400 hover:text-red-600 transition"
                >
                  <UserMinusIcon className="h-5 w-5" />
                </button>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Received</h3>
            {received.length === 0 ? (
              <p className="text-sm text-gray-400">No incoming requests.</p>
            ) : (
              <div className="space-y-3">
                {received.map((req) => (
                  <Card key={req.id} variant="glass" className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {req.sender_avatar ? (
                          <img src={req.sender_avatar} alt={req.sender_username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-600 font-semibold">
                            {req.sender_username?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{req.sender_username}</p>
                        {req.message && <p className="text-sm text-gray-500">{req.message}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAccept(req.id)}
                        title="Accept"
                        className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        title="Reject"
                        className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sent</h3>
            {sent.length === 0 ? (
              <p className="text-sm text-gray-400">No outgoing requests.</p>
            ) : (
              <div className="space-y-3">
                {sent.map((req) => (
                  <Card key={req.id} variant="glass" className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {req.receiver_avatar ? (
                          <img src={req.receiver_avatar} alt={req.receiver_username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-600 font-semibold">
                            {req.receiver_username?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">{req.receiver_username}</p>
                    </div>
                    <button
                      onClick={() => handleCancel(req.id)}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-red-600 border border-gray-300 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Find People Tab */}
      {activeTab === 'find' && (
        <div>
          <div className="relative mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by username or email..."
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
          </div>

          {isSearching ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : searchTerm.length < 2 ? (
            <p className="text-sm text-gray-400 text-center py-8">Type at least 2 characters to search.</p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No users found.</p>
          ) : (
            <div className="space-y-3">
              {searchResults.map((user) => (
                <Card key={user.id} variant="glass" className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold">
                        {user.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.username}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendRequest(user.id)}
                    disabled={sendingTo === user.id}
                    className="flex items-center gap-1"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    {sendingTo === user.id ? 'Sending...' : 'Add'}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
