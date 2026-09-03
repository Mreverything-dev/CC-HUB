// frontend/src/features/dashboard/pages/admin/AdminMeethubPage.tsx
import { LivestreamMonitorTable } from '../../components/admin/livestreams/LivestreamMonitorTable';

export default function AdminMeethubPage() {
  return (
    <LivestreamMonitorTable
      context="meeting"
      title="Meethub"
      subtitle="Monitor active class meetings and end one if necessary."
      emptyLabel="No Meethub meetings right now."
      itemNoun="meetings"
    />
  );
}
