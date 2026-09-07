import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, RotateCcw, Megaphone } from 'lucide-react';
import type { AppState } from '@/shared/types';
import { DEPT_COLOR } from '@/shared/constants';
import { tts } from '@/src/lib/tts';

export default function AnnounceBar({ state }: { state: AppState }) {
  const last = state.announcements[state.announcements.length - 1];
  const [, force] = useState(0);
  const spoken = useRef<number | null>(null);

  // 仅在新公告 id 出现且语音开启时自动播；静音期间不追播
  useEffect(() => {
    if (last && last.id !== spoken.current && tts.isEnabled()) {
      spoken.current = last.id;
      tts.announce(last.id, last.text);
    }
  }, [last]);

  const enabled = tts.isEnabled();
  const toggleVoice = () => {
    tts.setEnabled(!enabled);
    force((x) => x + 1);
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Megaphone className="h-5 w-5 text-rose-500" />
          实时叫号播报
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => tts.replayLast()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            title="重播"
          >
            <RotateCcw className="h-4 w-4" />
            重播
          </button>
          <button
            onClick={toggleVoice}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-white ${enabled ? 'bg-slate-700' : 'bg-slate-400'}`}
          >
            {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {enabled ? '语音开' : '语音关'}
          </button>
        </div>
      </div>
      {last ? (
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-4 ring-1 ring-blue-200">
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl font-black text-white ${DEPT_COLOR[last.department].bg}`}>
            {last.department}
          </div>
          <div className="text-3xl font-black leading-tight text-slate-900">{last.text}</div>
        </div>
      ) : (
        <div className="py-6 text-center text-xl text-slate-400">等待面试官呼叫…（扫码可在线取号排队）</div>
      )}
    </div>
  );
}
