import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Shown in the message so the user knows which app failed. */
  appName?: string;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render error must never leave a blank white page
 * with no way back. Shows a friendly Arabic message plus recovery buttons.
 */
export class SanadErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the console useful for debugging on the live site
    console.error('[Sanad] render error:', error.message, info.componentStack?.slice(0, 400));
  }

  private goHome = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('app', url.searchParams.get('app') || 'client');
      url.searchParams.delete('tab');
      window.location.replace(url.toString());
    } catch {
      window.location.href = '/';
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h1 className="text-base font-black text-slate-900">صار خطأ غير متوقع</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              {this.props.appName ? `في ${this.props.appName}. ` : ''}
              بياناتك محفوظة، بس الصفحة محتاجة إعادة تحميل. اضغط الزر تحت وكل شي بيرجع زي ما كان.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> إعادة التحميل
            </button>
            <button
              onClick={this.goHome}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" /> الصفحة الرئيسية
            </button>
          </div>

          <details className="text-start">
            <summary className="text-[10px] text-slate-400 cursor-pointer">تفاصيل تقنية</summary>
            <pre className="mt-1 text-[9px] text-slate-500 bg-slate-50 rounded-lg p-2 overflow-auto max-h-32 whitespace-pre-wrap break-all">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

export default SanadErrorBoundary;
