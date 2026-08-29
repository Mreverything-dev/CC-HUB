// frontend/src/components/ui/Logo/Logo.tsx
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import logoLight from '@/assets/images/logo/logo-light.png';
import logoDark from '@/assets/images/logo/logo-dark.png';
import logoIconLight from '@/assets/images/logo/logo-icon-light.png';
import logoIconDark from '@/assets/images/logo/logo-icon-dark.png';

/** Which surface the logo sits on - selects the light- or dark-colored logo
 * asset for contrast against that surface. CCS HUB's UI is dark-themed
 * almost everywhere, so every call site should pass 'dark' unless it's
 * actually rendering on a light/white surface. */
export type LogoBackground = 'dark' | 'light';

function resolveLogoSrc(iconOnly: boolean, background: LogoBackground): string {
  if (iconOnly) return background === 'dark' ? logoIconLight : logoIconDark;
  return background === 'dark' ? logoLight : logoDark;
}

/** The current logo PNGs are a dark mark on a transparent background, which
 * all but disappears against this app's dark UI. Rather than showing the
 * asset's own (currently very low-contrast) color, every logo is rendered
 * as this fixed dark-cyan color, using the PNG purely as a shape/alpha mask
 * (CSS mask-image) - so it stays clearly visible regardless of what the
 * underlying asset file's own pixel colors are. Matches the app's existing
 * cyan brand accent (#00C8FF is the bright highlight color used elsewhere;
 * this is a deliberately darker/more solid shade of the same hue so the
 * mark reads as a filled icon rather than a glowing highlight). */
const LOGO_TINT = '#0E7490';

function LogoMark({ src, sizeClassName, className }: { src: string; sizeClassName: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label="CCS HUB"
      className={cn(`inline-block flex-shrink-0 ${sizeClassName} ${className || ''}`)}
      style={{
        backgroundColor: LOGO_TINT,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}

interface LogoProps {
  variant?: 'full' | 'icon' | 'icon-only';
  /** Surface the logo is placed on; picks the correctly-contrasted asset. */
  background?: LogoBackground;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  /** Route the logo links to. Defaults to "/". Pass the caller's own
   * role-based dashboard path (see e.g. ProfilePage/ChatPage) when using
   * this inside an authenticated layout, so clicking it goes to that
   * user's Home/Feed instead of bouncing through the public "/" redirect. */
  to?: string;
}

export function Logo({
  variant = 'full',
  background = 'dark',
  className = '',
  size = 'md',
  showText = true,
  textColor = 'text-white',
  to = '/',
}: LogoProps) {
  // ✅ Larger logo sizes
  const sizes = {
    sm: { 
      size: 'w-10 h-10',     // 40px - Small icon
      text: 'text-sm',       // 14px
      gap: 'gap-2' 
    },
    md: { 
      size: 'w-14 h-14',     // 56px - Standard navbar
      text: 'text-lg',       // 18px
      gap: 'gap-3' 
    },
    lg: { 
      size: 'w-20 h-20',     // 80px - Large display
      text: 'text-2xl',      // 24px
      gap: 'gap-4' 
    },
    xl: { 
      size: 'w-28 h-28',     // 112px - Hero/landing pages
      text: 'text-3xl',      // 30px
      gap: 'gap-5' 
    },
  };

  const sizeClass = sizes[size];
  const iconOnly = variant === 'icon' || variant === 'icon-only';
  const logoSrc = resolveLogoSrc(iconOnly, background);

  return (
    <Link to={to} className={cn(`flex items-center ${sizeClass.gap} ${className}`)}>
      <LogoMark src={logoSrc} sizeClassName={sizeClass.size} />
      {showText && variant !== 'icon-only' && (
        <span className={cn(`font-bold ${sizeClass.text} ${textColor}`)}>
          CCS HUB
        </span>
      )}
    </Link>
  );
}

// ✅ Logo with custom text (for light surfaces)
export function LogoWithText({
  className = '',
  size = 'md',
  textColor = 'text-gray-900',
  background = 'dark',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  textColor?: string;
  background?: LogoBackground;
}) {
  const sizes = {
    sm: { text: 'text-sm', icon: 'w-10 h-10' },   // 14px text, 40px icon
    md: { text: 'text-base', icon: 'w-14 h-14' }, // 16px text, 56px icon
    lg: { text: 'text-xl', icon: 'w-20 h-20' },   // 20px text, 80px icon
  };

  const sizeClass = sizes[size];

  return (
    <div className={cn(`flex items-center gap-3 ${className}`)}>
      <LogoMark src={resolveLogoSrc(true, background)} sizeClassName={sizeClass.icon} />
      <span className={cn(`font-bold ${sizeClass.text} ${textColor}`)}>
        <span className="text-blue-600">CCS</span>
        <span> HUB</span>
      </span>
    </div>
  );
}

// ✅ Logo icon only (for mobile, sidebar, or small spaces)
export function LogoIcon({
  size = 'md',
  className = '',
  background = 'dark',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  background?: LogoBackground;
}) {
  // ✅ Larger icon sizes
  const sizes = {
    xs: 'w-8 h-8',    // 32px - Tiny icons
    sm: 'w-10 h-10',  // 40px - Small icons
    md: 'w-14 h-14',  // 56px - Standard icon
    lg: 'w-20 h-20',  // 80px - Large icon
  };

  return <LogoMark src={resolveLogoSrc(true, background)} sizeClassName={sizes[size]} className={className} />;
}