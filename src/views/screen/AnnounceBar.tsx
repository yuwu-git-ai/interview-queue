import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, RotateCcw, Megaphone } from 'lucide-react';
import type { Announcement, AppState } from '@/shared/types';
import { DEPT_COLOR } from '@/shared/constants';
import { tts } from '@/src/lib/tts';

/** 单次叫号横幅停留时长：语音播完后多留几秒给等候室看清，到期自动消失（不一直挂着） */
const CALL_FLASH_MS = 10000;

export default function AnnounceBar({ state }: { state: AppState }) {
  const last = state.announcements[state.announcements.length - 1];
  const [, force] = useState(0);
  // 当前正在闪播的公告；null = 空闲态
  const [live, setLive] = useState<Announcement | null>(null);
  const seenId = useRef<number>(0); // 已处理的最大公告 id（启动时已存在的记作已读，不重播旧叫号）
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (a: Announcement) => {
    setLive(a);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setLive(null), CALL_FLASH_MS);
  };

  // 只在“面试官新呼叫”产生的公告出现时闪播一次：语音播一遍 + 横幅展示 CALL_FLASH_MS 后消失；
  // 页面启动 / 普通轮询 / 静音期间出现的新公告不触发语音追播。
  useEffect(() => {
    if (!last) return;
    if (seenId.current === 0) {
      seenId.current = last.id; // 首次挂载：把当前最新公告记为已读，避免重播开场前的旧叫号
      return;
    }
    if (last.id <= seenId.current) return; // 同一公告的轮询刷新（对象换了但 id 没变）→ 忽略
    seenId.current = last.id;
    flash(last);
    if (tts.isEnabled()) tts.announce(last.id, last.text);
  }, [last]);

  // 卸载时清掉隐藏定时器，避免对已卸载组件 setState
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

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
            onClick={() => {
              tts.replayLast();
              if (last) flash(last); // 重播：横幅也重新闪播一次
            }}
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

      {live ? (
        <div
          key={live.id}
          className="iq-call-flash flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-4 ring-2 ring-blue-300"
        >
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl font-black text-white ${DEPT_COLOR[live.department].bg}`}>
            {live.department}
          </div>
          <div className="text-3xl font-black leading-tight text-slate-900">{live.text}</div>
        </div>
      ) : (
        <div className="py-6 text-center text-xl text-slate-400">等待面试官呼叫…（扫码可在线取号排队）</div>
      )}
    </div>
  );
}
