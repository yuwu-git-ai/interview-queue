import { DEPARTMENTS, WAIT_ROOM } from '@/shared/constants';
import type { FrontStore } from '@/src/lib/store';
import QrCard from '@/src/components/QrCard';
import AnnounceBar from './AnnounceBar';
import DeptColumn from './DeptColumn';

export default function ScreenView({ store }: { store: FrontStore }) {
  const s = store.state;
  // 按教室分组各部门，顶部位置提示随配置自动更新
  const rooms = Object.entries(
    DEPARTMENTS.reduce<Record<string, string[]>>((m, d) => {
      (m[d.room] ??= []).push(d.name);
      return m;
    }, {})
  );
  return (
    // 桌面(=投影大屏)固定占满高度；窄屏(手机)改为自然流式、页面可上下滚动
    <div className="flex flex-col gap-3 p-3 lg:h-full">
      {/* 顶部指引：位置提示仅宽屏显示，窄屏只留等候室徽标避免换行拥挤 */}
      <header className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 shadow">
        <span className="rounded-lg bg-rose-600 px-3 py-1 text-base font-black text-white lg:text-lg">等候室 {WAIT_ROOM}</span>
        <div className="hidden gap-4 text-sm font-bold text-slate-600 lg:flex">
          {rooms.map(([room, names]) => (
            <span key={room}>
              📍 {names.join(' & ')} <span className="text-blue-700">➜ {room}</span>
            </span>
          ))}
        </div>
      </header>

      {/* 中部：宽屏 左二维码 + 右叫号播报；窄屏 叫号播报整行优先 */}
      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
        <QrCard className="hidden lg:col-span-2 lg:flex lg:h-full" />
        <div className="lg:col-span-10">
          <AnnounceBar state={s} />
        </div>
      </div>

      {/* 部门看板：宽屏 4 列并排；平板 2 列；手机 1 列竖排（信息最全、字号可读） */}
      <div className="grid gap-3 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-4">
        {DEPARTMENTS.map((d) => (
          <DeptColumn key={d.code} state={s} code={d.code} />
        ))}
      </div>

      {/* 底部统计 */}
      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-2 text-sm shadow">
        <span className="font-bold text-slate-700">
          总登记 {s.stats.total} · 面试中 {s.stats.interviewing} · 等候中 {s.stats.waiting} · 已完成 {s.stats.completed}
        </span>
        <span className="text-slate-400">面试排队叫号系统 · 数据实时同步</span>
      </footer>
    </div>
  );
}
