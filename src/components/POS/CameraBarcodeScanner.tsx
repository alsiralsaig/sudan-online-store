import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap, Volume2, VolumeX, AlertTriangle, CheckCircle, Barcode, HelpCircle } from 'lucide-react';

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  soundEnabled?: boolean;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  soundEnabled = true,
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'sanad-camera-scanner-viewport';
  const isMountedRef = useRef(true);

  // Play beep sound
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1750, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1950, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio autoplay restrictions handled
    }
  };

  // Initialize camera list
  useEffect(() => {
    isMountedRef.current = true;
    if (!isOpen) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMountedRef.current) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if available
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('خلف')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorMsg('لم يتم العثور على كاميرات متصلة بهذا الجهاز.');
        }
      })
      .catch((err) => {
        if (!isMountedRef.current) return;
        console.warn('Camera permission or access error:', err);
        setErrorMsg('تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن للمتصفح بالوصول لكاميرا الجهاز.');
      });

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [isOpen]);

  // Start scanning when camera is selected
  useEffect(() => {
    if (!isOpen || !selectedCameraId) return;
    startScanner(selectedCameraId);

    return () => {
      stopScanner();
    };
  }, [isOpen, selectedCameraId]);

  const startScanner = async (cameraId: string) => {
    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const width = Math.floor(minEdge * 0.85);
          const height = Math.floor(minEdge * 0.55);
          return { width, height };
        },
        aspectRatio: 1.333,
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame scan failure (expected during live feed while searching for barcode)
        }
      );

      setIsScanning(true);
      setErrorMsg(null);

      // Check flashlight support
      try {
        const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
        setHasTorch(Boolean(capabilities?.torchFeature()?.isSupported()));
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Failed to start barcode scanner:', err);
      setIsScanning(false);
      setErrorMsg(err?.message || 'تعذر بدء تشغيل الكاميرا. تأكد من إغلاق أي تطبيق آخر يستخدم الكاميرا.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchOn(false);
  };

  const handleSuccessfulScan = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Avoid immediate duplicate scans of the exact same code in < 1.2s
    if (cleanCode === lastScanned) {
      return;
    }

    setLastScanned(cleanCode);
    playBeep();
    onScanSuccess(cleanCode);

    // If single mode, close scanner immediately
    if (!continuousMode) {
      stopScanner();
      onClose();
    } else {
      // Clear lastScanned after 1.5 seconds to allow rescanning the same item
      setTimeout(() => {
        setLastScanned(null);
      }, 1500);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].id);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccessfulScan(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 text-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-700 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">مسح الباركود عبر كاميرا الجهاز</h3>
              <p className="text-[11px] text-slate-400">
                وجّه الكاميرا نحو باركود الصنف (EAN / QR / Code128)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Container */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          {/* HTML5 QrCode attaches to this div */}
          <div id={containerId} className="w-full max-w-md h-full aspect-[4/3]" />

          {/* Laser scanning line overlay */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Reticle guide corners */}
              <div className="relative w-64 h-36 border-2 border-emerald-400/80 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center">
                {/* Animated horizontal laser beam */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
                <div className="text-[11px] font-mono text-emerald-300/80 bg-slate-900/70 px-2 py-0.5 rounded-full backdrop-blur-xs">
                  ضع الباركود داخل الإطار
                </div>
              </div>
            </div>
          )}

          {/* Flash feedback overlay on scan */}
          {lastScanned && (
            <div className="absolute inset-0 bg-emerald-500/30 backdrop-blur-xs flex items-center justify-center transition-opacity duration-300">
              <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-xl">
                <CheckCircle className="w-5 h-5" />
                <span>تم المسح بنجاح: {lastScanned}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="absolute inset-x-4 top-4 p-3 bg-rose-950/90 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-start gap-2 shadow-lg">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{errorMsg}</p>
                <p className="text-[10px] text-rose-300/80 mt-1">
                  يمكنك أيضاً كتابة رقم الباركود يدوياً بالأسفل لإضافته فوراً.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar & Controls */}
        <div className="p-3 bg-slate-800/90 border-t border-slate-700 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {/* Camera selector or Switch button */}
            <div className="flex items-center gap-1.5">
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="التبديل بين الكاميرات (أمامية / خلفية)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تبديل الكاميرا</span>
                </button>
              )}

              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    torchOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                  title="تشغيل كشاف الإضاءة (الفلاش)"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{torchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}</span>
                </button>
              )}
            </div>

            {/* Continuous scan toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span className="text-slate-300 font-medium">مسح مستمر (أصناف متعددة)</span>
            </label>
          </div>

          {/* Manual Barcode Input Fallback */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-700/60 flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="إدخال رقم الباركود يدوياً (مثال: 628100123001)..."
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
            >
              إضافة للفاتورة
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
