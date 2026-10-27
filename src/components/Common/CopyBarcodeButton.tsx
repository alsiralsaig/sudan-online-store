import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

type Props = {
  code?: string | null;
  className?: string;
  compact?: boolean;
};

export const CopyBarcodeButton: React.FC<Props> = ({ code, className = '', compact = false }) => {
  const [copied, setCopied] = useState(false);
  const value = (code || '').trim();

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  if (!value) {
    return <span className={`text-slate-400 text-[10px] ${className}`}>ما في باركود</span>;
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="نسخ الباركود"
      className={`group inline-flex items-center gap-1 max-w-full text-right ${className}`}
    >
      <span className={`font-mono font-bold select-all break-all ${compact ? 'text-[10px]' : 'text-xs'}`} dir="ltr">
        {value}
      </span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
      )}
      {copied && !compact && (
        <span className="text-[10px] text-emerald-700 font-sans font-bold">تم النسخ</span>
      )}
    </button>
  );
};
