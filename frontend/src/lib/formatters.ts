export const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTime = (date: Date | string) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Chat-style relative time: "Just now", "2 mins ago", "1hr ago", "3d ago", then a short date.
export const formatChatTime = (date: Date | string) => {
  const target = new Date(date).getTime();
  const seconds = Math.floor((Date.now() - target) / 1000);

  if (seconds < 45) return 'Just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}hr${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
