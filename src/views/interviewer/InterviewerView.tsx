import { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarPlus, ClipboardList, LogOut, PhoneForwarded, Sparkles, Trash2, UserPlus, X } from 'lucide-react';
import type { Candidate, DeptCode, Judgment } from '@/shared/types';
import { DEPARTMENTS, DEPT_COLOR, DEPT_MAP, MOBILE_RE } from '@/shared/constants';
import { listByStatus } from '@/shared/engine';
import type { FrontStore } from '@/src/lib/store';
import ArchiveModal from './ArchiveModal';

export default function InterviewerView({ store }: { store: FrontStore }) {
  const [authed, setAuthed] = useState<boolean>(() => store.kind === 'local' || !!sessionStorage.getItem('iq_token'));
  const [adding, setAdding] = useState<DeptCode | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showNewDay, setShowNewDay] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);

  if (!authed) return <Login store={store} onOk={() => setAuthed(true)} />;

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-black">面试官调度控制台</h1>
        <button
          onClick={() => {
            sessionStorage.removeItem('iq_token');
            setAuthed(false);
          }}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          登出
        </button>
      </header>
      <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
        叫号将即时同步到等候室大屏并语音播报（需大屏端语音开启）。
      </p>

      {/* 总览 + 名单汇总 / 开启新一天 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="text-sm font-bold text-slate-700">
          <span className="mr-2 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-black text-white">第 {store.state.currentSession} 天</span>
          已登记 {store.state.stats.total} · 面试中 {store.state.stats.interviewing} · 等待 {store.state.stats.waiting} · 已完成{' '}
          {store.state.stats.completed}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowArchive(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-slate-900"
          >
            <ClipboardList className="h-4 w-4" />
            名单汇总 / 导出
          </button>
          <button
            onClick={() => setShowNewDay(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
          >
            <CalendarPlus className="h-4 w-4" />
            开启新一天
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {DEPARTMENTS.map((d) => (
          <DeptCard key={d.code} store={store} code={d.code} onAdd={() => setAdding(d.code)} onRecord={(id) => setRecording(id)} />
        ))}
      </div>

      {adding && <AddCandidateModal store={store} dept={adding} onClose={() => setAdding(null)} />}
      {showArchive && <ArchiveModal store={store} onClose={() => setShowArchive(false)} />}
      {showNewDay && <NewDayModal store={store} onClose={() => setShowNewDay(false)} />}
      {recording && <RecordModal store={store} candidateId={recording} onClose={() => setRecording(null)} />}
    </div>
  );
}

/* ---------- 单部门卡片：面试中(可一组多人) + 勾选叫号 + 手动排序 ---------- */
function DeptCard({ store, code, onAdd, onRecord }: { store: FrontStore; code: DeptCode; onAdd: () => void; onRecord: (candidateId: string) => void }) {
  const col = DEPT_COLOR[code];
  const d = DEPT_MAP[code];
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [del, setDel] = useState<Candidate | null>(null);
  const { interviewing, waiting } = listByStatus(store.state, code);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const selectedIds = waiting.filter((w) => sel[w.id]).map((w) => w.id);
  const toggleSel = (id: string) => setSel((m) => ({ ...m, [id]: !m[id] }));
  const setAll = (v: boolean) => setSel(Object.fromEntries(waiting.map((w) => [w.id, v])));
  const callSelected = () =>
    run(async () => {
      await store.call(code, selectedIds);
      setSel({});
    });
  const completeAll = () =>
    run(async () => {
      for (const c of interviewing) await store.complete(c.id);
    });
  const reorder = (candId: string, action: 'top' | 'up' | 'down') => run(() => store.reorder(code, candId, action));

  return (
    <>
    <section className={`flex min-h-0 flex-col rounded-2xl border ${col.border} bg-white shadow`}>
      <header className={`flex items-center justify-between rounded-t-2xl ${col.soft} border-b px-4 py-2`}>
        <div className="font-black">
          {d.name} <span className="text-sm font-normal text-slate-500">（面试室 {d.room}）</span>
        </div>
        <button
          onClick={onAdd}
          title="现场没扫码的同学，手动录入进队列"
          className={`inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-sm font-bold ${col.text} ${col.border} hover:bg-slate-50`}
        >
          <UserPlus className="h-4 w-4" />
          补录
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        {/* 面试中（整组多人） */}
        <div className={`rounded-xl ${col.soft} border ${col.border} p-2.5`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              面试中{interviewing.length > 0 && <span className={col.text}> · {interviewing.length} 人</span>}
            </span>
            {interviewing.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => run(() => store.recall(code))}
                  disabled={busy}
                  title="对整组再叫一遍（催场）"
                  className={`rounded-md bg-white px-2 py-1 text-xs font-bold ${col.text} ring-1 ${col.border} disabled:opacity-40`}
                >
                  再叫一遍
                </button>
                <button
                  onClick={completeAll}
                  disabled={busy}
                  className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
                >
                  全部完成
                </button>
              </div>
            )}
          </div>
          {interviewing.length === 0 ? (
            <div className="py-2 text-center text-sm text-slate-400">暂无面试中</div>
          ) : (
            <ul className="mt-1 space-y-1">
              {interviewing.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5">
                  <div className="min-w-0">
                    <span className={`font-mono text-base font-black ${col.text}`}>{c.number}</span>
                    <span className="ml-1.5 font-bold">{c.name}</span>
                    <span className="ml-1 text-xs text-slate-400">{c.gradeClass || c.wechat || ''}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => onRecord(c.id)}
                      disabled={busy}
                      title="写面试备注 / 设临时判断"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    >
                      记录
                    </button>
                    <button
                      onClick={() => run(() => store.complete(c.id))}
                      disabled={busy}
                      className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
                    >
                      完成
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 等待队列：勾选多人一起叫 */}
        <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-slate-50 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              等待队列 · {waiting.length} 人<span className="ml-2 font-normal text-slate-400">勾选后一组一起叫</span>
            </span>
            {waiting.length > 0 && (
              <span className="flex items-center gap-2 text-xs">
                <button onClick={() => setAll(true)} className="font-bold text-blue-600 hover:underline">
                  全选
                </button>
                <button onClick={() => setSel({})} className="text-slate-500 hover:underline">
                  清空
                </button>
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {waiting.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-400">队列为空</div>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {waiting.map((w, i) => (
                  <li key={w.id} className="flex items-center gap-1.5 rounded-lg bg-white px-1.5 py-1">
                    <input
                      type="checkbox"
                      checked={!!sel[w.id]}
                      onChange={() => toggleSel(w.id)}
                      className="h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <span className={`font-mono text-base font-black ${col.text}`}>{w.number}</span>
                    <span className="min-w-0 truncate font-bold">{w.name}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{w.gradeClass || w.wechat || w.mobile}</span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <MiniBtn title="置顶" onClick={() => reorder(w.id, 'top')}>
                        <Sparkles className="h-3.5 w-3.5" />
                      </MiniBtn>
                      <MiniBtn title="上移" disabled={i === 0} onClick={() => reorder(w.id, 'up')}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </MiniBtn>
                      <MiniBtn title="下移" disabled={i === waiting.length - 1} onClick={() => reorder(w.id, 'down')}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </MiniBtn>
                      <button
                        onClick={() => setDel(w)}
                        title="删除这条(误录/测试号)"
                        className="rounded border border-slate-200 bg-white p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={callSelected}
            disabled={selectedIds.length === 0 || busy}
            className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 font-bold text-white transition active:scale-[0.99] disabled:opacity-40 ${col.bg}`}
          >
            <PhoneForwarded className="h-4 w-4" />
            {busy ? '处理中…' : selectedIds.length === 0 ? '勾选面试者后一组叫号' : `叫这一组（${selectedIds.length} 人）去面试`}
          </button>
          {err && <p className="mt-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600">{err}</p>}
        </div>
      </div>
    </section>
    {del && (
      <DeleteConfirm
        name={`${del.number} ${del.name}`}
        sub={`从当前队列/名单中删除「${DEPT_MAP[del.department].name}」这一条，不可恢复。号码不复用。`}
        busy={busy}
        onCancel={() => setDel(null)}
        onConfirm={() =>
          run(async () => {
            await store.remove(del.id);
            setSel({});
            setDel(null);
          })
        }
      />
    )}
    </>
  );
}

/* ---------- 通用删除确认弹窗 ---------- */
function DeleteConfirm({
  name, sub, busy, onCancel, onConfirm,
}: {
  name: string;
  sub: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4" onClick={busy ? undefined : onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-rose-600">删除这条记录？</h3>
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{name}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{sub}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} disabled={busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            {busy ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}

const MiniBtn = ({ children, onClick, disabled, title }: any) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    className="rounded border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
  >
    {children}
  </button>
);

function Login({ store, onOk }: { store: FrontStore; onOk: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await store.login(pw);
      onOk();
    } catch (e: any) {
      setErr(e.status === 401 ? '密码错误' : e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid h-full place-items-center bg-slate-100">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="w-72 rounded-2xl bg-white p-6 shadow"
      >
        <h1 className="mb-1 text-xl font-black">面试官登录</h1>
        <p className="mb-4 text-xs text-slate-400">请联系考务人员获取访问密码</p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="请输入密码"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
        />
        {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-lg bg-slate-800 py-2.5 font-bold text-white hover:bg-slate-900 disabled:opacity-50">
          {busy ? '登录中…' : '登 录'}
        </button>
      </form>
    </div>
  );
}

/* ---------- 补录弹窗：现场没扫码的同学，面试官手动录入 ---------- */
function AddCandidateModal({
  store, dept, onClose,
}: {
  store: FrontStore;
  dept: DeptCode;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: '', mobile: '', wechat: '', gradeClass: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const d = DEPT_MAP[dept];
  const col = DEPT_COLOR[dept];
  const valid = !!form.name.trim() && MOBILE_RE.test(form.mobile);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      await store.staffRegister({
        department: dept,
        name: form.name.trim(),
        mobile: form.mobile,
        wechat: form.wechat.trim(),
        gradeClass: form.gradeClass.trim(),
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message || '补录失败');
      setBusy(false);
    }
  }

  const inp =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">补录登记</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {d.name}（面试室 {d.room}）· 现场同学未扫码时由面试官录入
        </p>

        <div className="mt-4 space-y-3.5">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              真实姓名<span className="ml-0.5 text-rose-500">*</span>
            </span>
            <input className={`mt-1.5 ${inp}`} value={form.name} onChange={set('name')} placeholder="请输入姓名" />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              手机号<span className="ml-0.5 text-rose-500">*</span>
            </span>
            <input className={`mt-1.5 ${inp}`} inputMode="numeric" maxLength={11} value={form.mobile} onChange={set('mobile')} placeholder="11 位，用于查重与进度查询" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                微信号<span className="ml-1 text-xs font-normal text-slate-400">（选填）</span>
              </span>
              <input className={`mt-1.5 ${inp}`} value={form.wechat} onChange={set('wechat')} placeholder="微信号" />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                班级<span className="ml-1 text-xs font-normal text-slate-400">（选填）</span>
              </span>
              <input className={`mt-1.5 ${inp}`} value={form.gradeClass} onChange={set('gradeClass')} placeholder="如：25电子商务" />
            </label>
          </div>
          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{err}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className={`flex-1 rounded-xl py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:bg-slate-300 ${col.bg}`}
          >
            {busy ? '添加中…' : `添加进${d.name}队列`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 开启新一天（两步确认，防误触） ---------- */
function NewDayModal({ store, onClose }: { store: FrontStore; onClose: () => void }) {
  const [step, setStep] = useState<'intro' | 'confirm'>('intro');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = store.state;
  const undone = s.stats.waiting + s.stats.interviewing;

  async function go() {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await store.startNewSession();
      onClose();
    } catch (e: any) {
      setErr(e?.message || '操作失败');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {step === 'intro' ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800">
                第 {s.currentSession} 天 → 开启第 {s.currentSession + 1} 天？
              </h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
              <p>当前第 {s.currentSession} 天共有 <b>{s.stats.total}</b> 人：</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                <li>已完成 {s.stats.completed} 人 → 保留为“已完成”，进历史</li>
                <li>未面试完 {undone} 人 → 记为“已过号”，进历史</li>
              </ul>
            </div>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              新一天将清空看板 / 叫号 / 统计，号码从 A01 重新排。
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                取消
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-900"
              >
                我了解，继续
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-rose-600">二次确认：不可撤销</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-3 text-sm leading-relaxed text-rose-700">
              确认后第 {s.currentSession} 天全部记录将立即归档进历史，看板清空并进入第 {s.currentSession + 1} 天。
              <br />
              历史仍可在「名单汇总」中查看与导出。
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>我已了解，确实要开启新一天</span>
            </label>
            {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setStep('intro')} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                返回
              </button>
              <button
                onClick={go}
                disabled={!checked || busy}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:bg-slate-300"
              >
                {busy ? '处理中…' : '确认归档并开启新一天'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 面试记录：临时判断 + 追加式备注（多面试官并发不冲突） ---------- */
const JUDGE_OPTIONS: { value: Judgment; label: string; active: string }[] = [
  { value: 'pass', label: '通过', active: 'bg-emerald-600 border-emerald-600 text-white' },
  { value: 'fail', label: '不通过', active: 'bg-rose-600 border-rose-600 text-white' },
  { value: 'discuss', label: '待商讨', active: 'bg-amber-500 border-amber-500 text-white' },
];

function RecordModal({ store, candidateId, onClose }: { store: FrontStore; candidateId: string; onClose: () => void }) {
  const cand = store.state.candidates.find((c) => c.id === candidateId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-3" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {!cand ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-500">该记录已归档或不存在（可能已开启新一天）。</p>
            <button onClick={onClose} className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white">
              关闭
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  <span className="font-mono">{cand.number}</span> {cand.name}
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    {DEPT_MAP[cand.department].name}（{DEPT_MAP[cand.department].room}）
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {cand.gradeClass || '—'} · {cand.mobile}
                </p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {/* 临时判断 */}
              <p className="mb-2 text-sm font-bold text-slate-700">临时判断（选填）</p>
              <div className="flex flex-wrap gap-2">
                {JUDGE_OPTIONS.map((o) => {
                  const on = cand.judgment === o.value;
                  return (
                    <button
                      key={o.value}
                      onClick={() => run(() => store.judge(cand.id, on ? null : o.value))}
                      disabled={busy}
                      className={`rounded-lg border px-3.5 py-2 text-sm font-bold transition disabled:opacity-40 ${
                        on ? o.active : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => run(() => store.judge(cand.id, null))}
                  disabled={busy || !cand.judgment}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-400 hover:bg-slate-50 disabled:opacity-30"
                >
                  清除判断
                </button>
              </div>

              {/* 备注（评论线程式） */}
              <p className="mb-2 mt-6 text-sm font-bold text-slate-700">
                面试备注（{cand.comments.length}）
                <span className="ml-1 font-normal text-slate-400">— 多位面试官各自追加，互不覆盖</span>
              </p>
              <div className="max-h-52 space-y-2 overflow-auto rounded-xl bg-slate-50 p-3">
                {cand.comments.length === 0 ? (
                  <p className="py-3 text-center text-sm text-slate-400">暂无备注</p>
                ) : (
                  cand.comments.map((cm) => (
                    <div key={cm.id} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                      <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{cm.text}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{new Date(cm.at).toLocaleString('zh-CN')}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  placeholder="写一条面试备注（选填）…"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                />
                <button
                  onClick={() =>
                    run(async () => {
                      await store.comment(cand.id, text);
                      setText('');
                    })
                  }
                  disabled={busy || !text.trim()}
                  className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  添加
                </button>
              </div>
              {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-400">临时判断已即时保存 · 备注选填</p>
              <button onClick={onClose} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
                完成记录
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
