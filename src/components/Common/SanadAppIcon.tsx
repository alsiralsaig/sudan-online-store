import React from 'react';

export type SanadAppKey = 'client' | 'merchant' | 'super_admin';

/**
 * The official Sanad app icon.
 *
 * The brand rule is strict: every app tile uses the exact same artwork
 * (dark green #052e1a tile, white cloud/cart, orange accents) and differs
 * only in the label rendered underneath it. Never swap this for a generic
 * lucide glyph or an emoji — those were the placeholder icons.
 */
export const SANAD_APP_META: Record<SanadAppKey, { label: string; subtitle: string }> = {
  client: { label: 'السند', subtitle: 'تطبيق الجمهور والزبائن' },
  merchant: { label: 'تاجر السند', subtitle: 'نقاط البيع والمخزون' },
  super_admin: { label: 'إدارة السند', subtitle: 'لوحة الإدارة المركزية' },
};

const SIZES = { xs: 20, sm: 28, md: 40, lg: 56, xl: 80 } as const;

interface SanadAppIconProps {
  app?: SanadAppKey;
  size?: keyof typeof SIZES;
  showLabel?: boolean;
  /** Render the label inside the tile's caption area (as in a launcher grid). */
  labelClassName?: string;
  className?: string;
}

export const SanadAppIcon: React.FC<SanadAppIconProps> = ({
  app = 'client',
  size = 'md',
  showLabel = false,
  labelClassName = '',
  className = '',
}) => {
  const px = SIZES[size];
  const meta = SANAD_APP_META[app];

  const tile = (
    <span
      className={`inline-flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/10 shrink-0 ${className}`}
      style={{ width: px, height: px, borderRadius: Math.round(px * 0.24), backgroundColor: '#052e1a' }}
      aria-label={meta.label}
      role="img"
    >
      <img
        src="/icons/sanad-icon-192.png"
        alt=""
        width={px}
        height={px}
        className="w-full h-full object-cover"
        draggable={false}
      />
    </span>
  );

  if (!showLabel) return tile;

  return (
    <span className="inline-flex flex-col items-center gap-1">
      {tile}
      <span className={`text-[11px] font-black leading-none whitespace-nowrap ${labelClassName}`}>
        {meta.label}
      </span>
    </span>
  );
};
