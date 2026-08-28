// frontend/src/features/livestream/components/CreateMeethubModal.tsx
import GoLiveModal from './GoLiveModal';

interface CreateMeethubModalProps {
  onClose: () => void;
  /** The new MeethubSession's own id (not the underlying livestream id) -
   * the caller should navigate to /meethub/:sessionId with it. */
  onSessionCreated: (sessionId: string) => void;
}

/**
 * Thin Meethub-branded wrapper around GoLiveModal's 'meethub' variant - all
 * camera/screen/mic setup, thumbnail, visibility, and scheduling logic lives
 * in exactly one place (GoLiveModal) so it never has to be kept in sync
 * across two parallel modals.
 */
export default function CreateMeethubModal({ onClose, onSessionCreated }: CreateMeethubModalProps) {
  return <GoLiveModal variant="meethub" onClose={onClose} onStreamCreated={onSessionCreated} />;
}
