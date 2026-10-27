import React, { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  title?: string;
};

export const LiveCameraSheet: React.FC<Props> = ({ onCapture, onClose, title = 'تصوير الصنف' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          await video.play();
          setReady(true);
        }
      } catch {
        setError('ما قدرنا نفتح الكاميرا. اسمح للكاميرا من إعدادات التطبيق، أو استخدم الاستوديو.');
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col" dir="rtl">
      <div className="flex items-center justify-between px-3 py-2 text-white bg-black/80">
        <span className="font-bold text-sm">{title}</span>
        <button type="button" onClick={onClose} className="p-2" aria-label="إغلاق">
          <X className="w-5 h-5" />
        </button>
      </div>
      {error ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-rose-200 text-sm font-bold text-center leading-relaxed">{error}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="flex-1 w-full object-cover bg-black"
          playsInline
          muted
          autoPlay
        />
      )}
      <div className="p-4 bg-black/90">
        <button
          type="button"
          onClick={snap}
          disabled={!ready || !!error}
          className="w-full py-3 rounded-2xl bg-emerald-600 disabled:opacity-40 text-white font-black flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" />
          التقاط
        </button>
      </div>
    </div>
  );
};
