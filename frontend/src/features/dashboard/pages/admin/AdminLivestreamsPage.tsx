// frontend/src/features/dashboard/pages/admin/AdminLivestreamsPage.tsx
import { LivestreamMonitorTable } from '../../components/admin/livestreams/LivestreamMonitorTable';

export default function AdminLivestreamsPage() {
  return (
    <LivestreamMonitorTable
      context="stream"
      title="Livestreams"
      subtitle="Monitor and moderate every livestream on CCS HUB."
      emptyLabel="No livestreams right now."
      itemNoun="livestreams"
    />
  );
}
