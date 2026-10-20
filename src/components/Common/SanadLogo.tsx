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
      {/* Sanad Geometric Emblem Icon */}
      <div
        className={`relative ${iconDimensions[size]} rounded-xl p-0.5 bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-800 shadow-md shadow-emerald-600/20 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/20`}
      >
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:6px_6px]" />

        {/* Dynamic Islamic geometric & cloud POS SVG */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1 drop-shadow-sm"
        >
          {/* Base Support Pillar Shape */}
          <path
            d="M24 6L38 14V34L24 42L10 34V14L24 6Z"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />

          {/* Golden support curve */}
          <path
            d="M14 26C16 32 20 35 25 35C31.5 35 35 29 35 22C35 15 28 12 21 15"
            stroke="#fbbf24"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Stylized Arabic "Seen" (س) & upward growth arrow */}
          <path
            d="M13 22C14 18 16 18 18 22C19.5 18 21.5 18 23 22C24 16 28 13 32 17"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* POS Smart Dot / Terminal Beacon */}
          <circle cx="24" cy="24" r="3" fill="#ffffff" />
          <circle cx="34" cy="14" r="2.5" fill="#34d399" />
          <path
            d="M31 11L37 17"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Ambient glow highlight */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-white/25 rounded-bl-full pointer-events-none" />
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
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 tracking-wider">
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
