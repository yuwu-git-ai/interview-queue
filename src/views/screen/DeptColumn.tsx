import { useEffect, useState } from 'react';
import { Clock, UserCheck, Users } from 'lucide-react';
import type { AppState, DeptCode } from '@/shared/types';
import { DEPT_MAP, DEPT_COLOR, WAIT_ROOM } from '@/shared/constants';
import { listByStatus } from '@/shared/engine';
import DeptBadge from '@/src/components/DeptBadge';

function Elapsed({ start }: { start?: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!start) return null;
  const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return (
    <span className="ml-1 inline-flex items-center gap-1 text-sm">
      <Clock className="h-4 w-4" />
      {mm}:{ss}
    </span>
  );
}

export default function DeptColumn({ state, code }: { state: AppState; code: DeptCode }) {
  const d = DEPT_MAP[code];
  const c = DEPT_COLOR[code];
  const { interviewing, waiting, completed } = listByStatus(state, code);
  const current = interviewing[0];

  return (
    <section className={`flex min-h-0 flex-col rounded-2xl border-t-4 ${c.border} bg-white shadow`}>
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <DeptBadge code={code} />
          <span className="text-lg font-black">{d.name}</span>
        </div>
        <div className="text-sm text-slate-500">
          面试室 {d.room}
          <span className="mx-1 text-slate-300">|</span>
          等候室 {WAIT_ROOM}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 pb-3 scrollbar-none">
        {/* 面试中 */}
        <div className={`rounded-xl ${c.soft} border ${c.border} p-3`}>
          <div className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
            <UserCheck className="h-3.5 w-3.5" />
            面试中
          </div>
          {current ? (
            <div className="flex items-end justify-between">
              <div>
                <div className={`text-4xl font-black ${c.text}`}>{current.number}</div>
                <div className="text-xl font-bold">
                  {current.name} · {current.gradeClass}
                </div>
              </div>
              <Elapsed start={current.interviewStartedAt} />
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400">— 暂无面试 —</div>
          )}
        </div>

        {/* 等待队列 */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
            <Users className="h-3.5 w-3.5" />
            等待面试 · {waiting.length}人
          </div>
          <ol className="space-y-1.5">
            {waiting.length === 0 && <li className="text-center text-sm text-slate-400">暂无等待</li>}
            {waiting.map((w, i) => (
              <li
                key={w.id}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                  i === 0 ? 'bg-white font-bold ring-1 ring-amber-300' : 'bg-white/60'
                }`}
              >
                <span className="font-mono text-base font-bold text-slate-800">{w.number}</span>
                <span className="truncate text-slate-700">{w.name}</span>
                {i === 0 && <span className="rounded bg-amber-400 px-1.5 text-xs font-bold text-white">下一位</span>}
              </li>
            ))}
          </ol>
        </div>

        {/* 已完成 */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 text-xs font-bold text-slate-500">已面试完 · {completed.length}</div>
          <div className="flex flex-wrap gap-1">
            {completed
              .slice(-12)
              .reverse()
              .map((cand) => (
                <span key={cand.id} className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                  {cand.number} {cand.name}
                </span>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
