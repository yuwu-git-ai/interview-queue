import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { qrDataUrl, registerUrl } from '@/src/lib/qrcode';

export default function QrCard({ className = '', zoomable = true }: { className?: string; zoomable?: boolean }) {
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    qrDataUrl(registerUrl(), 720).then(setUrl);
  }, []);
  if (zoom) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setZoom(false)}>
        <div className="max-w-3xl rounded-3xl bg-white p-8 text-center">
          {url && <img src={url} alt="扫码取号" className="mx-auto w-[70vmin]" />}
          <p className="mt-4 text-2xl font-bold text-slate-800">微信 / 相机扫码 · 在线取号排队</p>
          <button className="mt-4 text-slate-500 underline">点击任意处关闭</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center rounded-2xl bg-white p-4 shadow ${className}`}>
      {url ? (
        <img src={url} alt="扫码取号" className="w-full" />
      ) : (
        <div className="grid aspect-square w-full place-items-center">
          <QrCode className="h-16 w-16 text-slate-300" />
        </div>
      )}
      <p className="mt-3 text-center font-bold text-slate-800">微信 / 相机扫码 · 在线取号排队</p>
      {zoomable && (
        <button onClick={() => setZoom(true)} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          全屏放大二维码
        </button>
      )}
    </div>
  );
}
