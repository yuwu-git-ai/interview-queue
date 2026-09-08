import { useState } from 'react';
import { Download, History, Search, X } from 'lucide-react';
import type { Candidate, DeptCode, Judgment, Status } from '@/shared/types';
import { DEPARTMENTS, DEPT_COLOR, DEPT_MAP } from '@/shared/constants';
import type { FrontStore } from '@/src/lib/store';
import { buildXlsx, downloadBlob } from '@/src/lib/xlsx';

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

function judgmentText(j?: Judgment): string {
  return j === 'pass' ? '通过' : j === 'fail' ? '不通过' : j === 'discuss' ? '待商讨' : '';
}
const JUDGMENT_COLOR: Record<Judgment, string> = {
  pass: 'bg-emerald-100 text-emerald-700',
  fail: 'bg-rose-100 text-rose-700',
  discuss: 'bg-amber-100 text-amber-700',
};

function csvEsc(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** 名单汇总：当前天 + 历史场次归档，可展开看备注/判断，导出 CSV */
export default function ArchiveModal({ store, onClose }: { store: FrontStore; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<'' | DeptCode>('');
  const [status, setStatus] = useState<'' | Status | 'all'>('all');
  const [day, setDay] = useState<string>('');
  const [del, setDel] = useState<Candidate | null>(null);

  const s = store.state;
  const all = [...s.archive, ...s.candidates];
  const days = Array.from(new Set(all.map((c) => c.day))).sort((a, b) => (a < b ? -1 : 1));

  const rows = all.filter((c) => {
    if (dept && c.department !== dept) return false;
    if (day && c.day !== day) return false;
    if (status !== 'all' && c.status !== status) return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const hay = `${c.name} ${c.mobile} ${c.wechat} ${c.gradeClass}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const makeTable = () => {
    const header = ['场次/日期', '部门', '号码', '姓名', '状态', '临时判断', '微信号', '手机号', '班级', '面试备注', '登记时间'];
    const body = rows.map((c) => [
      c.day,
      DEPT_MAP[c.department].name,
      c.number,
      c.name,
      STATUS_TEXT[c.status],
      judgmentText(c.judgment),
      c.wechat,
      c.mobile,
      c.gradeClass,
      (c.comments || []).map((cm) => `${new Date(cm.at).toLocaleString('zh-CN')}：${cm.text}`).join(' | '),
      new Date(c.registeredAt).toLocaleString('zh-CN'),
    ]);
    return { header, body };
  };

  const stamp = () => `_第${s.currentSession}天_${new Date().toISOString().slice(0, 10)}`;

  const exportCsv = () => {
    const { header, body } = makeTable();
    const csv = [header, ...body].map((r) => r.map(csvEsc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `面试名单汇总${stamp()}.csv`);
  };

  const exportExcel = () => {
    const { header, body } = makeTable();
    const blob = buildXlsx('名单汇总', header, body);
    downloadBlob(blob, `面试名单汇总${stamp()}.xlsx`);
  };

  const sel =
    'rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none';

  return (
    <>
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-3" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
              <History className="h-5 w-5 text-slate-400" />
              名单汇总
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-black text-white">当前第 {s.currentSession} 天</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              共 {all.length} 人（含历史归档 {s.archive.length} 人）· 点条目可展开看备注 · 可搜索 / 筛选 / 导出 CSV
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              导出 Excel
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
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
          <select value={day} onChange={(e) => setDay(e.target.value)} className={sel}>
            <option value="">全部场次</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
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
              {rows.map((c) => (
                <ArchiveRow key={c.id} cand={c} onRemove={() => setDel(c)} />
              ))}
            </ul>
          )}
        </div>

        {/* 底部统计 */}
        <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">
          显示 {rows.length} / {all.length} 人
        </div>
      </div>
    </div>

    {/* 删除确认 */}
    {del && (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4" onClick={() => setDel(null)}>
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-black text-rose-600">删除这条记录？</h3>
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            {del.number} {del.name} · {DEPT_MAP[del.department].name} · {del.day}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            将把它从名单与导出中永久删除，不可恢复；若它还在当前队列也会一并移除。
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setDel(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
              取消
            </button>
            <button
              onClick={async () => {
                await store.remove(del.id);
                setDel(null);
              }}
              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function ArchiveRow({ cand, onRemove }: { cand: Candidate; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const col = DEPT_COLOR[cand.department];
  const jt = judgmentText(cand.judgment);
  const comments = cand.comments || [];
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cand.wechat || cand.mobile);
    } catch {
      /* ignore */
    }
  };

  return (
    <li className={`rounded-xl ${open ? 'bg-white ring-1 ring-slate-200' : 'bg-slate-50'}`}>
      {/* 概要行：点击展开 */}
      <div className="flex cursor-pointer items-center gap-3 px-3 py-2.5" onClick={() => setOpen((o) => !o)}>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-base font-black text-white ${col.bg}`}>
          {cand.department}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-base font-black text-slate-800">{cand.number}</span>
            <span className="font-bold text-slate-800">{cand.name}</span>
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{cand.day}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[cand.status]}`}>{STATUS_TEXT[cand.status]}</span>
            {jt && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${JUDGMENT_COLOR[cand.judgment!]}`}>{jt}</span>}
            {comments.length > 0 && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">备注 {comments.length}</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            微信 {cand.wechat || '—'} · 手机 {cand.mobile} · {cand.gradeClass || '无班级'}
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold text-slate-400">{open ? '收起 ▲' : '查看 ▼'}</span>
        <button
          onClick={copy}
          title="复制微信号"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          复制微信
        </button>
      </div>

      {/* 展开详情：判断 + 备注 */}
      {open && (
        <div className="border-t border-dashed border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-400">临时判断：{jt ? <b className="text-slate-700">{jt}</b> : '未填写'}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">
            面试备注{comments.length > 0 ? `（${comments.length}）` : ''}
          </p>
          {comments.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">暂无备注</p>
          ) : (
            <ul className="mt-1 space-y-1.5">
              {comments.map((cm) => (
                <li key={cm.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{cm.text}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{new Date(cm.at).toLocaleString('zh-CN')}</p>
                </li>
              ))}
            </ul>
          )}
          {cand.note && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">报名备注：{cand.note}</p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              onClick={onRemove}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
            >
              删除这条
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
