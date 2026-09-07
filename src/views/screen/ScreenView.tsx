import { DEPARTMENTS } from '@/shared/constants';
import type { FrontStore } from '@/src/lib/store';
import QrCard from '@/src/components/QrCard';
import AnnounceBar from './AnnounceBar';
import DeptColumn from './DeptColumn';

export default function ScreenView({ store }: { store: FrontStore }) {
  const s = store.state;
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* 顶部指引 */}
      <header className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 shadow">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-rose-600 px-3 py-1 text-lg font-black text-white">当前所在：教208 · 候考等候室</span>
        </div>
        <div className="flex gap-4 text-sm font-bold text-slate-600">
          <span>
            📍 事业部 &amp; 综务部 <span className="text-blue-700">➜ 教210</span>
          </span>
          <span>
            📍 信技部 &amp; 宣传部 <span className="text-orange-600">➜ 教211</span>
          </span>
        </div>
      </header>

      {/* 中部：左二维码 + 右叫号 */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        <div className="col-span-2 min-h-0">
          <QrCard className="h-full" />
        </div>
        <div className="col-span-10 min-h-0">
          <AnnounceBar state={s} />
        </div>
      </div>

      {/* 4 部门看板 */}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-3">
        {DEPARTMENTS.map((d) => (
          <DeptColumn key={d.code} state={s} code={d.code} />
        ))}
      </div>

      {/* 底部统计 */}
      <footer className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 text-sm shadow">
        <span className="font-bold text-slate-700">
          总登记 {s.stats.total} · 面试中 {s.stats.interviewing} · 等候中 {s.stats.waiting} · 已完成 {s.stats.completed}
        </span>
        <span className="text-slate-400">面试排队叫号系统 · 数据实时同步</span>
      </footer>
    </div>
  );
}
