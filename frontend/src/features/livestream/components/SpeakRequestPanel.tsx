// frontend/src/features/livestream/components/SpeakRequestPanel.tsx
import { Avatar } from '@/features/dashboard/components/Avatar';
import { SpeakRequest } from '@/types/meethub.types';
import { HandRaisedIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SpeakRequestPanelProps {
  requests: SpeakRequest[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  onClose: () => void;
}

/**
 * Organizer-only queue of pending "raise hand" requests for a Meethub
 * session - mirrors LiveStreamStage's Viewers modal shell exactly so it
 * looks native to the existing livestream UI rather than introducing a new
 * visual language.
 */
export function SpeakRequestPanel({ requests, onApprove, onDeny, onClose }: SpeakRequestPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
      <div className="bg-[#0D1722] rounded-2xl max-w-md w-full max-h-[80vh] border border-[#1E3447]">
        <div className="flex items-center justify-between p-4 border-b border-[#1E3447]">
          <h3 className="text-lg font-bold text-[#F1F5F9] flex items-center gap-2">
            <HandRaisedIcon className="h-5 w-5 text-[#00C8FF]" />
            Raised Hands ({requests.length})
          </h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#F1F5F9]">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
          {requests.length === 0 ? (
            <p className="text-center text-[#94A3B8] py-8">No one has raised their hand yet.</p>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#0A111A] border border-[#1E3447]">
                <Avatar src={req.avatar} name={req.username} size="sm" />
                <p className="flex-1 min-w-0 text-sm font-medium text-[#F1F5F9] truncate">{req.username}</p>
                <button
                  onClick={() => onApprove(req.id)}
                  title="Allow to speak"
                  className="p-1.5 rounded-lg bg-[#22C55E]/15 text-[#22C55E] hover:bg-[#22C55E]/25 transition"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDeny(req.id)}
                  title="Deny"
                  className="p-1.5 rounded-lg bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25 transition"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
