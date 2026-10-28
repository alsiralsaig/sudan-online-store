import React, { useCallback, useEffect, useRef, useState } from 'react';
import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  AlertTriangle,
  CheckCircle,
  Barcode,
  ImagePlus,
  ZoomIn,
} from 'lucide-react';

// Load ZXing C++ WebAssembly locally from same-origin /wasm/zxing_reader.wasm (works offline & without external CDNs)
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => {
      if (path.endsWith('.wasm')) return '/wasm/zxing_reader.wasm';
      return prefix + path;
    },
  },
});

const ZXING_BASE_OPTIONS: ReaderOptions = {
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
  formats: [
    'EAN-13',
    'EAN-8',
    'UPC-A',
    'UPC-E',
    'Code128',
    'Code39',
    'Code93',
    'ITF',
    'Codabar',
    'QRCode',
    'DataMatrix',
  ],
};

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  soundEnabled?: boolean;
  defaultContinuous?: boolean;
  submitLabel?: string;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  soundEnabled = true,
  defaultContinuous = false,
  submitLabel = 'إضافة للفاتورة',
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [continuousMode, setContinuousMode] = useState(defaultContinuous);
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [focusTapPoint, setFocusTapPoint] = useState<{ x: number; y: number } | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const scanLoopTimerRef = useRef<number | null>(null);
  const isBusyDecodingRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const continuousModeRef = useRef(continuousMode);
  const frameCounterRef = useRef(0);

  useEffect(() => {
    continuousModeRef.current = continuousMode;
  }, [continuousMode]);

  useEffect(() => {
    if (isOpen) {
      setContinuousMode(defaultContinuous);
      setLastScanned(null);
      setErrorMsg(null);
    }
  }, [isOpen, defaultContinuous]);

  // Play crisp POS beep sound + subtle vibration
  const playBeep = useCallback(() => {
    try {
      navigator.vibrate?.(60);
    } catch {
      // ignore
    }
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
  }, [soundEnabled]);

  const stopScanner = useCallback(() => {
    if (scanLoopTimerRef.current !== null) {
      window.clearTimeout(scanLoopTimerRef.current);
      scanLoopTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isBusyDecodingRef.current = false;
    setIsScanning(false);
    setTorchOn(false);
    setHasTorch(false);
    setZoomRange(null);
    setZoomLevel(1);
  }, []);

  const handleSuccessfulScan = useCallback(
    (rawCode: string) => {
      const cleanCode = rawCode.trim();
      if (!cleanCode) return;

      const now = Date.now();
      if (
        lastScannedCodeRef.current.code === cleanCode &&
        now - lastScannedCodeRef.current.time < 1600
      ) {
        return;
      }

      lastScannedCodeRef.current = { code: cleanCode, time: now };
      setLastScanned(cleanCode);
      playBeep();
      onScanSuccess(cleanCode);

      if (!continuousModeRef.current) {
        window.setTimeout(() => {
          stopScanner();
          onClose();
        }, 280);
      } else {
        window.setTimeout(() => {
          if (isMountedRef.current) {
            setLastScanned(null);
          }
        }, 1300);
      }
    },
    [onClose, onScanSuccess, playBeep, stopScanner]
  );

  // Start camera stream & dual-engine barcode reader
  const startCamera = useCallback(
    async (explicitDeviceId?: string) => {
      stopScanner();
      setErrorMsg(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg('المتصفح الحالي لا يدعم تشغيل الكاميرا مباشرة. استخدم زر «تصوير الكود» بالأسفل.');
        return;
      }

      let stream: MediaStream | null = null;
      const constraintAttempts: MediaStreamConstraints[] = explicitDeviceId
        ? [
            {
              audio: false,
              video: {
                deviceId: { exact: explicitDeviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
            },
            {
              audio: false,
              video: { deviceId: { exact: explicitDeviceId } },
            },
          ]
        : [
            // Let Android/iOS OS pick the PRIMARY autofocus rear camera (camera 0) at Full HD 1080p
            {
              audio: false,
              video: {
                facingMode: { exact: 'environment' },
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
              },
            },
            {
              audio: false,
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
            },
            {
              audio: false,
              video: { facingMode: 'environment' },
            },
            { audio: false, video: true },
          ];

      let lastErr: any = null;
      for (const constraints of constraintAttempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!isMountedRef.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!stream) {
        console.warn('Camera open error:', lastErr);
        setErrorMsg(
          'تعذر الوصول إلى الكاميرا. تأكد من منح الإذن للكاميرا في المتصفح أو استخدم زر «تصوير الكود».'
        );
        return;
      }

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const activeSettings = videoTrack?.getSettings?.() || {};
      if (activeSettings.deviceId && !explicitDeviceId) {
        setSelectedCameraId(activeSettings.deviceId);
      }

      // Refresh camera list (sorting primary rear camera 0 first)
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices
          .filter((d) => d.kind === 'videoinput')
          .map((d, idx) => ({
            id: d.deviceId,
            label: d.label || `كاميرا ${idx + 1}`,
          }));

        videoDevices.sort((a, b) => {
          const score = (lbl: string) => {
            const l = lbl.toLowerCase();
            let s = 0;
            if (l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('خلف')) s += 10;
            if (l.includes('camera2 0') || l.includes('camera 0') || l.includes('0, facing back')) s += 20;
            if (l.includes('wide') || l.includes('ultra') || l.includes('macro')) s -= 8;
            return s;
          };
          return score(b.label) - score(a.label);
        });

        if (isMountedRef.current) {
          setCameras(videoDevices);
        }
      } catch {
        // ignore enumerate error
      }

      // Apply continuous autofocus, exposure & inspect torch + zoom capabilities
      if (videoTrack) {
        try {
          const caps: any = (videoTrack as any).getCapabilities?.() || {};
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
          }
          if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
            await videoTrack.applyConstraints({ advanced: [{ exposureMode: 'continuous' } as any] }).catch(() => {});
          }
          setHasTorch(Boolean(caps.torch));
          if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number' && caps.zoom.max > 1.1) {
            setZoomRange({ min: caps.zoom.min, max: Math.min(caps.zoom.max, 4) });
          }
        } catch {
          // ignore capability errors
        }
      }

      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', 'true');
        await videoEl.play().catch(() => {});
      }

      if (!isMountedRef.current) return;
      setIsScanning(true);

      // Prepare optional Native BarcodeDetector (fast hardware MLKit path when supported)
      let nativeDetector: any = null;
      const NativeBD = (window as any).BarcodeDetector;
      if (NativeBD) {
        try {
          nativeDetector = new NativeBD({
            formats: [
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'code_128',
              'code_39',
              'code_93',
              'itf',
              'codabar',
              'qr_code',
              'data_matrix',
            ],
          });
        } catch {
          try {
            nativeDetector = new NativeBD();
          } catch {
            nativeDetector = null;
          }
        }
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      // Continuous non-overlapping decode loop (Native + ZXing C++ WASM)
      const tick = async () => {
        if (!isMountedRef.current || !streamRef.current) return;

        const v = videoRef.current;
        if (v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && !isBusyDecodingRef.current) {
          isBusyDecodingRef.current = true;
          frameCounterRef.current += 1;
          const frameIdx = frameCounterRef.current;

          try {
            let foundText: string | null = null;

            // 1) Try hardware BarcodeDetector first if available
            if (nativeDetector) {
              try {
                const nativeHits = await nativeDetector.detect(v);
                if (Array.isArray(nativeHits) && nativeHits.length > 0 && nativeHits[0]?.rawValue) {
                  foundText = String(nativeHits[0].rawValue);
                }
              } catch {
                // Native detector may fail on devices without MLKit models; ZXing WASM below handles it
              }
            }

            // 2) ZXing C++ WASM fallback / primary engine (works on ALL phones without Google Play Services)
            if (!foundText && canvasRef.current) {
              const vw = v.videoWidth;
              const vh = v.videoHeight;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });

              if (ctx) {
                // Alternate between crisp center horizontal band (best for 1D EAN/Code128 with full quiet zones)
                // and full frame (best for QR / off-center barcodes)
                const useFullFrame = frameIdx % 3 === 0;
                const sx = 0;
                const sy = useFullFrame ? 0 : Math.floor(vh * 0.2);
                const sw = vw;
                const sh = useFullFrame ? vh : Math.floor(vh * 0.6);

                const maxTargetW = useFullFrame ? 1080 : 1440;
                const scale = sw > maxTargetW ? maxTargetW / sw : 1;
                const dw = Math.max(1, Math.floor(sw * scale));
                const dh = Math.max(1, Math.floor(sh * scale));

                canvas.width = dw;
                canvas.height = dh;
                ctx.drawImage(v, sx, sy, sw, sh, 0, 0, dw, dh);

                const imageData = ctx.getImageData(0, 0, dw, dh);
                const zxingHits = await readBarcodes(imageData, {
                  ...ZXING_BASE_OPTIONS,
                  binarizer: frameIdx % 2 === 0 ? 'LocalAverage' : 'GlobalHistogram',
                });

                if (zxingHits && zxingHits.length > 0 && zxingHits[0]?.text) {
                  foundText = zxingHits[0].text;
                }
              }
            }

            if (foundText && isMountedRef.current) {
              handleSuccessfulScan(foundText);
            }
          } catch {
            // ignore transient frame error
          } finally {
            isBusyDecodingRef.current = false;
          }
        }

        if (isMountedRef.current && streamRef.current) {
          scanLoopTimerRef.current = window.setTimeout(tick, 90);
        }
      };

      scanLoopTimerRef.current = window.setTimeout(tick, 120);
    },
    [handleSuccessfulScan, stopScanner]
  );

  // Open/close lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    if (!isOpen) {
      stopScanner();
      return;
    }

    startCamera();

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [isOpen, startCamera, stopScanner]);

  // Tap-to-focus handler on video
  const handleVideoTap = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFocusTapPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    window.setTimeout(() => {
      if (isMountedRef.current) setFocusTapPoint(null);
    }, 700);

    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      const caps: any = (track as any).getCapabilities?.() || {};
      if (Array.isArray(caps.focusMode)) {
        if (caps.focusMode.includes('single-shot')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' } as any] }).catch(() => {});
        }
        window.setTimeout(() => {
          if (caps.focusMode.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
          }
        }, 450);
      }
    } catch {
      // ignore
    }
  };

  const applyZoom = async (targetZoom: number) => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track || !zoomRange) return;
    const clamped = Math.min(Math.max(targetZoom, zoomRange.min), zoomRange.max);
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
      setZoomLevel(clamped);
    } catch {
      // ignore
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: nextState } as any] });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextId = cameras[nextIndex].id;
    setSelectedCameraId(nextId);
    startCamera(nextId);
  };

  // Decode still photo captured from native camera or gallery
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsProcessingPhoto(true);
    setErrorMsg(null);
    try {
      let decoded: string | null = null;

      // Try ZXing C++ WASM with both binarizers
      const resLocal = await readBarcodes(file, {
        ...ZXING_BASE_OPTIONS,
        binarizer: 'LocalAverage',
      });
      if (resLocal.length > 0 && resLocal[0]?.text) {
        decoded = resLocal[0].text;
      } else {
        const resHist = await readBarcodes(file, {
          ...ZXING_BASE_OPTIONS,
          binarizer: 'GlobalHistogram',
        });
        if (resHist.length > 0 && resHist[0]?.text) {
          decoded = resHist[0].text;
        }
      }

      // Fallback to native BarcodeDetector on ImageBitmap
      if (!decoded && (window as any).BarcodeDetector && window.createImageBitmap) {
        try {
          const bmp = await createImageBitmap(file);
          const bd = new (window as any).BarcodeDetector();
          const hits = await bd.detect(bmp);
          if (hits?.length > 0 && hits[0]?.rawValue) {
            decoded = String(hits[0].rawValue);
          }
        } catch {
          // ignore
        }
      }

      if (decoded) {
        handleSuccessfulScan(decoded);
      } else {
        setErrorMsg('لم يظهر باركود واضح في الصورة. قرّب الكود في إضاءة جيدة وحاول مرة أخرى.');
      }
    } catch {
      setErrorMsg('تعذر قراءة الصورة، جرّب تصوير الباركود بشكل أوضح.');
    } finally {
      if (isMountedRef.current) setIsProcessingPhoto(false);
    }
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
                اضغط على الشاشة للتركيز · يدعم EAN-13 و QR و Code128
              </p>
            </div>
          </div>
          <button
            type="button"
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
        <div
          onClick={handleVideoTap}
          className="relative bg-black flex flex-col items-center justify-center min-h-[290px] max-h-[380px] overflow-hidden cursor-pointer select-none"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-[300px] sm:h-[340px] object-cover"
          />

          {/* Tap-to-focus indicator */}
          {focusTapPoint && (
            <div
              style={{ left: focusTapPoint.x - 24, top: focusTapPoint.y - 24 }}
              className="absolute w-12 h-12 border-2 border-amber-400 rounded-lg pointer-events-none animate-ping"
            />
          )}

          {/* Clean wide reticle overlay (label placed ABOVE box so barcode bars stay unobstructed) */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center px-5">
              <div className="mb-2 text-[11px] font-bold text-emerald-300 bg-slate-950/75 px-3 py-1 rounded-full border border-emerald-500/30">
                ضع الباركود بالعرض داخل الإطار (أبعد الجوال قليلاً ليتضح التركيز)
              </div>
              <div className="relative w-full max-w-[320px] h-36 border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] flex items-center justify-center">
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
              </div>
            </div>
          )}

          {/* Quick Zoom Pills (1x / 1.5x / 2x) when camera supports optical/digital zoom */}
          {isScanning && zoomRange && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/80 border border-slate-700 px-2.5 py-1 rounded-full text-[11px]"
            >
              <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
              {[1, 1.5, 2]
                .filter((z) => z >= zoomRange.min && z <= zoomRange.max)
                .map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => applyZoom(z)}
                    className={`px-2 py-0.5 rounded-full font-mono font-bold transition-colors ${
                      Math.abs(zoomLevel - z) < 0.2
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {z}x
                  </button>
                ))}
            </div>
          )}

          {/* Flash feedback overlay on scan */}
          {lastScanned && (
            <div className="absolute inset-0 bg-emerald-500/35 backdrop-blur-xs flex items-center justify-center transition-opacity duration-200">
              <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-xl">
                <CheckCircle className="w-5 h-5" />
                <span dir="ltr" className="font-mono">{lastScanned}</span>
                <span>تمت القراءة</span>
              </div>
            </div>
          )}

          {/* Photo processing indicator */}
          {isProcessingPhoto && (
            <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center">
              <div className="bg-slate-800 border border-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جارٍ استخراج الباركود من الصورة...</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-4 top-3 p-3 bg-rose-950/95 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-start gap-2 shadow-lg"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Toolbar & Controls */}
        <div className="p-3 bg-slate-800/90 border-t border-slate-700 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="التبديل بين الكاميرات"
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
                  <span>{torchOn ? 'إطفاء الفلاش' : 'الفلاش'}</span>
                </button>
              )}

              {/* Direct native camera photo fallback for close-up / macro clarity */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="px-2.5 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="التقاط صورة عالية الدقة لقراءة الباركود الصغير"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>تصوير الكود</span>
              </button>
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
                inputMode="numeric"
                dir="ltr"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="إدخال رقم الباركود يدوياً..."
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors whitespace-nowrap"
            >
              {submitLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
