import React from 'react';

interface SanadLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'compact' | 'icon';
  theme?: 'light' | 'dark';
  className?: string;
  onClick?: () => void;
}

export const SanadLogo: React.FC<SanadLogoProps> = ({
  size = 'md',
  variant = 'full',
  theme = 'light',
  className = '',
  onClick,
}) => {
  // Size dimensions
  const iconDimensions = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const titleSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-2xl',
  };

  const subtitleSizes = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  const isDark = theme === 'dark';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${
        onClick ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''
      } ${className}`}
      dir="rtl"
    >
      {/* Official Sanad app icon — the same artwork used for the PWA icon,
          so the brand mark inside the app matches the icon on the home screen */}
      <div
        className={`relative ${iconDimensions[size]} rounded-xl overflow-hidden shadow-md shadow-emerald-900/25 shrink-0 ring-1 ring-black/10 bg-[#052e1a]`}
      >
        <img
          src="/icons/sanad-icon-192.png"
          alt="شعار سند"
          className="w-full h-full object-cover"
          draggable={false}
         referrerPolicy="no-referrer" />
      </div>

      {/* Brand Text Block */}
      {variant !== 'icon' && (
        <div className="flex flex-col text-right leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight ${titleSizes[size]} ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              سَنَد
            </span>
            <span className="hidden sm:inline-block font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 tracking-wider">
              SANAD POS
            </span>
          </div>

          {variant === 'full' && (
            <span
              className={`font-medium tracking-tight ${subtitleSizes[size]} ${
                isDark ? 'text-slate-300' : 'text-slate-500'
              } whitespace-nowrap`}
            >
              منظومة التجارة ونقاط البيع الذكية
            </span>
          )}
        </div>
      )}
    </div>
  );
};
