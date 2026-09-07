import { useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import type { DeptCode, Status } from '@/shared/types';
import { DEPARTMENTS, DEPT_COLOR, DEPT_MAP } from '@/shared/constants';
import type { FrontStore } from '@/src/lib/store';

const STATUS_TEXT: Record<Status, string> = {
  waiting: '等待面试',
  interviewing: '面试中',
  completed: '已面试完',
  no_show: '已过号',
};
const STATUS_COLOR: Record<Status, string> = {
  waiting: 'bg-amber-100 text-amber-700',
  interviewing: 'bg-rose-100 text-rose-700',
  completed: 'bg-emerald-100 text-emerald-700',
  no_show: 'bg-slate-200 text-slate-600',
};

function csvEsc(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** 已登记的完整名单汇总（含已完成）＋ 微信/手机展示 ＋ CSV 导出 */
export default function ArchiveModal({ store, onClose }: { store: FrontStore; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<'' | DeptCode>('');
  const [status, setStatus] = useState<'' | Status | 'all'>('all');

  const rows = store.state.candidates.filter((c) => {
    if (dept && c.department !== dept) return false;
    if (status !== 'all' && c.status !== status) return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const hay = `${c.name} ${c.mobile} ${c.wechat} ${c.gradeClass}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const exportCsv = () => {
    const head = ['部门', '号码', '姓名', '状态', '微信号', '手机号', '班级', '面试结果', '登记时间'];
    const body = rows.map((c) => [
      DEPT_MAP[c.department].name,
      c.number,
      c.name,
      STATUS_TEXT[c.status],
      c.wechat,
      c.mobile,
      c.gradeClass,
      c.result === 'hired' ? '通过' : c.result === 'rejected' ? '淘汰' : c.result === 'pending' ? '待定' : '',
      new Date(c.registeredAt).toLocaleString('zh-CN'),
    ]);
    const csv = [head, ...body].map((r) => r.map(csvEsc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `面试名单汇总_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sel =
    'rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-3" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-lg font-black text-slate-800">名单汇总（共 {store.state.candidates.length} 人）</h2>
            <p className="text-xs text-slate-400">含已完成·含联系方式，可搜索 / 筛选 / 导出 CSV</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-900"
            >
              <Download className="h-4 w-4" />
              导出 CSV
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2.5">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 focus-within:border-blue-500 focus-within:bg-white">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
              placeholder="搜姓名 / 手机号 / 微信号 / 班级"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select value={dept} onChange={(e) => setDept(e.target.value as '' | DeptCode)} className={sel}>
            <option value="">全部部门</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} {d.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as '' | Status | 'all')} className={sel}>
            <option value="all">全部状态</option>
            <option value="waiting">等待面试</option>
            <option value="interviewing">面试中</option>
            <option value="completed">已面试完</option>
            <option value="no_show">已过号</option>
          </select>
        </div>

        {/* 列表 */}
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
          {rows.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">没有符合条件的记录</div>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((c) => {
                const col = DEPT_COLOR[c.department];
                const copy = async () => {
                  try {
                    await navigator.clipboard.writeText(c.wechat || c.mobile);
                  } catch {
                    /* ignore */
                  }
                };
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-base font-black text-white ${col.bg}`}>
                      {c.department}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className={`font-mono text-base font-black ${col.text}`}>{c.number}</span>
                        <span className="font-bold text-slate-800">{c.name}</span>
                        <span className="text-xs text-slate-400">{c.gradeClass}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[c.status]}`}>{STATUS_TEXT[c.status]}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        微信 {c.wechat || '—'} · 手机 {c.mobile}
                      </p>
                    </div>
                    <button
                      onClick={copy}
                      title="复制微信号"
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      复制微信
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 底部统计 */}
        <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">
          显示 {rows.length} / {store.state.candidates.length} 人
        </div>
      </div>
    </div>
  );
}
