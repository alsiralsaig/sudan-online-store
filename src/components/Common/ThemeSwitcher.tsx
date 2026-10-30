import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { useTheme, Theme } from '../../lib/theme.tsx';

export function ThemeSwitcher({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const opts: { id: Theme; label: string; icon: any }[] = [
    { id: 'light', label: 'نهاري', icon: Sun },
    { id: 'medium', label: 'متوسط', icon: MonitorSmartphone },
    { id: 'dark', label: 'ليلي', icon: Moon },
  ];
  return (
    <div className={`flex items-center gap-0.5 sm:gap-1 rounded-xl border bg-white/90 dark:bg-slate-900 p-0.5 sm:p-1 ${compact ? 'text-[11px]' : ''}`} dir="rtl">
      {opts.map(o => {
        const Icon = o.icon;
        const active = theme === o.id;
        return (
          <button key={o.id} onClick={() => setTheme(o.id)}
            className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-bold transition ${active ? 'bg-sky-500 text-white shadow' : 'text-slate-600 hover:bg-sky-50'}`}>
            <Icon className="w-3.5 h-3.5" /> {!compact && o.label}
          </button>
        );
      })}
    </div>
  );
}
