// frontend/src/features/legal/pages/TermsPage.tsx
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import heroImage from '@/assets/images/backgrounds/img-bg.png';
import { LogoIcon } from '@/components/ui/Logo/Logo';

const EFFECTIVE_DATE = 'September 7, 2026';

interface Section {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

const SECTIONS: Section[] = [
  {
    id: 'acceptance',
    title: '1. Introduction & Acceptance of Terms',
    paragraphs: [
      'CCS HUB ("the Platform", "we", "us") is a community and academic platform built for the students, faculty, and staff of the College of Computer Studies ("CCS"). These Terms & Conditions ("Terms") govern your access to and use of CCS HUB, including its posts, chat, announcements, livestream, and Meethub features.',
      'By creating an account, signing in (including via Google), or otherwise using CCS HUB, you confirm that you have read, understood, and agree to be bound by these Terms. If you do not agree, you must not register for or use the Platform.',
    ],
  },
  {
    id: 'eligibility',
    title: '2. Eligibility & Account Registration',
    paragraphs: [
      'CCS HUB is intended for currently enrolled students, faculty, and staff of the College of Computer Studies. Professor and admin accounts require a valid invitation code issued by an administrator; student accounts may self-register with a valid institutional or personal email address used in good faith.',
      'You must be able to form a binding agreement to use the Platform. Accounts may be verified, suspended, or removed at our discretion if eligibility cannot be confirmed.',
    ],
  },
  {
    id: 'account-responsibilities',
    title: '3. User Account Responsibilities',
    paragraphs: [
      'You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately if you suspect unauthorized access to your account.',
      'Accounts are personal and non-transferable. Sharing your account, impersonating another person, or creating an account on someone else\'s behalf without authorization is prohibited.',
    ],
  },
  {
    id: 'accurate-information',
    title: '4. Accurate User Information',
    paragraphs: [
      'You agree to provide accurate, current, and complete information when registering, including your name, role, section, and any academic identifiers requested during signup or profile setup, and to keep this information up to date.',
      'Providing false identity information, fabricated academic credentials (such as a fake student/employee ID or invitation code), or impersonating a professor, admin, or another student is a serious violation of these Terms.',
    ],
  },
  {
    id: 'acceptable-use',
    title: '5. Acceptable Use',
    paragraphs: [
      'CCS HUB is meant to support learning, communication, and community within the College of Computer Studies. You agree to use the Platform respectfully and only for lawful, legitimate academic and social purposes consistent with your institution\'s student/faculty code of conduct.',
    ],
  },
  {
    id: 'prohibited-content',
    title: '6. Prohibited Content and Behavior',
    paragraphs: [
      'The following are strictly prohibited anywhere on CCS HUB, including posts, comments, chat messages, announcements, livestream chat, and Meethub sessions:',
    ],
    bullets: [
      'Bullying or targeted harassment of any student, professor, staff member, or guest.',
      'Harassment, including repeated unwanted contact or messages after being asked to stop.',
      'Abuse, whether verbal, written, or through manipulated media, directed at any user.',
      'Threats of violence or content that incites harm against a person or group.',
      'Adult or sexually explicit content, including nudity or sexually suggestive material.',
      'Hate speech or discriminatory content based on race, ethnicity, gender, sexual orientation, religion, disability, or any other protected characteristic.',
      'False or misleading information, including academic misinformation or impersonation of staff/officials.',
      'Content that promotes, glorifies, or provides instructions for suicide or self-harm. If you or someone you know is struggling, please reach out to your institution\'s guidance office or a local crisis hotline immediately.',
      'Spam, unsolicited advertising, or any automated abuse of posts, comments, chat, or invitations.',
    ],
  },
  {
    id: 'content-features',
    title: '7. Posts, Comments, Chat and Announcements',
    paragraphs: [
      'You are solely responsible for the content you post, comment, or send via chat. Posts and comments may be visible to other users of the Platform depending on your privacy and section settings. Announcements are published by professors and admins for their relevant sections/audience and must be used only for legitimate academic or organizational purposes.',
      'We may remove any content that violates these Terms, without prior notice, and may take action against the account responsible.',
    ],
  },
  {
    id: 'friends-sections',
    title: '8. Friends and Section Groups',
    paragraphs: [
      'Friend connections and section groups are intended to reflect real academic and social relationships within CCS. Do not use these features to harvest contacts, spam other users, or gain unauthorized access to a section you are not enrolled in or assigned to teach.',
    ],
  },
  {
    id: 'livestream-meethub',
    title: '9. Livestream and Meethub Rules',
    paragraphs: [
      'Livestream and Meethub sessions may be used for classes, study groups, and community events. Hosts are responsible for the conduct of their sessions and must not use these features to broadcast prohibited content as described in Section 6.',
      'Recording, screenshotting, or redistributing a livestream or Meethub session without the consent of the participants and, where applicable, the instructor, is prohibited.',
    ],
  },
  {
    id: 'camera-mic',
    title: '10. Camera, Microphone and Screen Sharing Responsibilities',
    paragraphs: [
      'When you enable your camera, microphone, or screen share in a livestream or Meethub session, you are responsible for everything visible or audible in that feed, including your surroundings and any content shown on your screen. Do not share confidential, copyrighted, or inappropriate material while screen sharing.',
      'You may disable your camera or microphone at any time; some sessions (such as official class sessions) may require them to be enabled for attendance or participation purposes at the instructor\'s discretion.',
    ],
  },
  {
    id: 'attendance',
    title: '11. Attendance and Academic Features',
    paragraphs: [
      'Where CCS HUB is used to record attendance for official class sessions (e.g., via Meethub), attendance data is provided to the relevant professor and section as an academic record. Attempting to falsify attendance (e.g., joining and immediately leaving, or having another person join on your behalf) is an academic integrity violation and a violation of these Terms.',
    ],
  },
  {
    id: 'reports-moderation',
    title: '12. User Reports and Moderation',
    paragraphs: [
      'CCS HUB provides tools to report posts and users that violate these Terms. Reports are reviewed by administrators and, where appropriate, kept confidential from the reported user to protect the reporter.',
      'Submitting knowingly false reports to harass another user is itself a violation of these Terms and may result in restrictions on your own account.',
    ],
  },
  {
    id: 'restrictions',
    title: '13. Account Restrictions and Suspensions',
    paragraphs: [
      'Depending on the severity and history of a violation, we may issue a warning, apply a timed restriction (e.g., limiting posting, commenting, or chat), or suspend or terminate an account. Repeated or severe violations (such as threats, hate speech, or self-harm-related harmful content) may result in immediate suspension pending review.',
      'Moderation decisions and history are logged for administrative accountability and may be reviewed by CCS HUB administrators.',
    ],
  },
  {
    id: 'privacy',
    title: '14. Privacy and Personal Information',
    paragraphs: [
      'We collect the information necessary to operate CCS HUB, such as your account details, profile information, and content you create. Your email address is never shown to other users except where you choose to share it or where an administrator requires it for moderation purposes.',
      'We do not sell your personal information. Information may be shared internally with CCS faculty/administrators where necessary for academic or moderation purposes (e.g., attendance records, reported content).',
    ],
  },
  {
    id: 'uploaded-content',
    title: '15. Uploaded Content and Media',
    paragraphs: [
      'You retain ownership of the photos, videos, and files you upload, but you grant CCS HUB a limited license to store, display, and transmit that content as needed to operate the Platform (for example, showing your post to your section or friends).',
      'Do not upload content you do not have the right to share, or content that infringes another person\'s copyright or privacy.',
    ],
  },
  {
    id: 'intellectual-property',
    title: '16. Intellectual Property',
    paragraphs: [
      'The CCS HUB name, logo, design, and underlying software are the property of the College of Computer Studies and its developers. You may not copy, reverse-engineer, or redistribute the Platform itself without permission.',
    ],
  },
  {
    id: 'availability',
    title: '17. Platform Availability',
    paragraphs: [
      'CCS HUB is provided on an "as available" basis. We do not guarantee uninterrupted access and may perform maintenance, updates, or experience downtime without prior notice. We are not liable for any loss resulting from temporary unavailability of the Platform.',
    ],
  },
  {
    id: 'security',
    title: '18. Security and Unauthorized Access',
    paragraphs: [
      'You may not attempt to gain unauthorized access to another user\'s account, to sections you are not part of, or to any part of the Platform\'s infrastructure. Attempting to bypass security controls, probing for vulnerabilities without authorization, or interfering with the Platform\'s normal operation is prohibited and may be referred to your institution for disciplinary action.',
    ],
  },
  {
    id: 'termination',
    title: '19. Account Termination',
    paragraphs: [
      'You may stop using CCS HUB at any time. We may suspend or terminate your account for violation of these Terms, at the request of your institution, or if your account is no longer eligible (e.g., you are no longer enrolled or employed at CCS).',
    ],
  },
  {
    id: 'changes',
    title: '20. Changes to the Terms',
    paragraphs: [
      'We may update these Terms from time to time to reflect new features or requirements. Material changes will be reflected by updating the Effective Date below. Continued use of CCS HUB after changes take effect constitutes acceptance of the revised Terms.',
    ],
  },
  {
    id: 'contact',
    title: '21. Contact / Support',
    paragraphs: [
      'If you have questions about these Terms, need to report a concern, or require support, please contact your CCS HUB administrator or the College of Computer Studies office.',
    ],
  },
];

export function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050A0F] text-[#F1F5F9]">
      <div className="absolute inset-0 z-0">
        <img src={heroImage} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#050A0F]/80" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#050A0F] via-transparent to-[#050A0F]" />
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#00C8FF]/10 blur-[120px] z-0" />

      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#94A3B8] transition-colors hover:text-[#00C8FF]"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="rounded-3xl border border-[rgba(0,200,245,0.18)] bg-[rgba(13,23,34,0.85)] p-6 shadow-2xl backdrop-blur-xl md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00C8FF]/40 bg-[#00C8FF]/10">
              <LogoIcon size="sm" background="dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F1F5F9] md:text-3xl">Terms &amp; Conditions</h1>
              <p className="text-sm text-[#94A3B8]">CCS HUB — College of Computer Studies</p>
            </div>
          </div>

          <p className="mt-6 text-sm text-[#64748B]">Effective Date: {EFFECTIVE_DATE}</p>

          <div className="mt-8 space-y-8">
            {SECTIONS.map((section) => (
              <section key={section.id}>
                <h2 className="text-lg font-semibold text-[#F1F5F9]">{section.title}</h2>
                {section.paragraphs?.map((p, i) => (
                  <p key={i} className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-3 space-y-2">
                    {section.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-[#94A3B8]">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#00C8FF]" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-10 border-t border-[#1E3447] pt-6 text-center">
            <p className="text-sm text-[#94A3B8]">
              Already reviewed the Terms?{' '}
              <Link to="/register" className="font-medium text-[#00C8FF] transition-colors hover:text-[#00E0FF]">
                Back to Sign Up
              </Link>
              {' · '}
              <Link to="/login" className="font-medium text-[#00C8FF] transition-colors hover:text-[#00E0FF]">
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
