import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, LogOut, PhoneForwarded, Sparkles, UserPlus, X } from 'lucide-react';
import type { Candidate, DeptCode } from '@/shared/types';
import { DEPARTMENTS, DEPT_COLOR, DEPT_MAP, MOBILE_RE } from '@/shared/constants';
import { listByStatus } from '@/shared/engine';
import type { FrontStore } from '@/src/lib/store';

export default function InterviewerView({ store }: { store: FrontStore }) {
  const [authed, setAuthed] = useState<boolean>(() => store.kind === 'local' || !!sessionStorage.getItem('iq_token'));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [acting, setActing] = useState(false);
  const [busyDept, setBusyDept] = useState<DeptCode | null>(null);
  const [adding, setAdding] = useState<DeptCode | null>(null);

  const act = async (dept: DeptCode | null, fn: () => Promise<void>) => {
    if (acting) return;
    setActing(true);
    setBusyDept(dept);
    try {
      await fn();
    } finally {
      setActing(false);
      setBusyDept(null);
    }
  };

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

      <div className="grid gap-4 lg:grid-cols-2">
        {DEPARTMENTS.map((d) => {
          const col = DEPT_COLOR[d.code];
          const { interviewing, waiting } = listByStatus(store.state, d.code);
          const current = interviewing[0];
          const busy = acting && busyDept === d.code;
          return (
            <section key={d.code} className={`rounded-2xl border ${col.border} bg-white shadow`}>
              <header className={`flex items-center justify-between rounded-t-2xl ${col.soft} border-b px-4 py-2`}>
                <div className="font-black">
                  {d.name} <span className="text-sm font-normal text-slate-500">（面试室 {d.room}）</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAdding(d.code)}
                    title="现场没扫码的同学，手动录入进队列"
                    className={`inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-sm font-bold ${col.text} ${col.border} hover:bg-slate-50`}
                  >
                    <UserPlus className="h-4 w-4" />
                    补录
                  </button>
                  <button
                    disabled={waiting.length === 0 || acting}
                    onClick={() => act(d.code, () => store.callNext(d.code))}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold text-white disabled:opacity-40 ${col.bg}`}
                  >
                    <PhoneForwarded className="h-4 w-4" />
                    {busy ? '处理中…' : '呼叫下一位'}
                  </button>
                </div>
              </header>

              <div className="p-3">
                {current ? (
                  <div className={`mb-3 rounded-xl ${col.soft} p-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold">
                        面试中：
                        <span className="text-lg">
                          {current.number} {current.name}
                        </span>
                        <span className="ml-1 text-xs text-slate-500">{current.gradeClass}</span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => act(d.code, () => store.recall(d.code))}
                          disabled={acting}
                          title="再次呼叫（催场）"
                          className={`rounded-lg bg-white px-2 py-1 text-xs font-bold ${col.text} ring-1 ${col.border} disabled:opacity-40`}
                        >
                          再次呼叫
                        </button>
                        <button
                          onClick={() => act(d.code, () => store.complete(current.id))}
                          disabled={acting}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
                        >
                          完成
                        </button>
                      </div>
                    </div>
                    {current.note && <p className="mt-1 text-sm text-slate-600">备注：{current.note}</p>}
                  </div>
                ) : (
                  <div className="mb-3 rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-400">暂无面试中</div>
                )}

                <div className="text-xs font-bold text-slate-500">等待队列（{waiting.length}）· 置顶/上移/下移调整优先级</div>
                <ul className="mt-1 divide-y divide-slate-100">
                  {waiting.length === 0 && <li className="py-3 text-center text-sm text-slate-400">队列为空</li>}
                  {waiting.map((w, i) => (
                    <CandidateRow
                      key={w.id}
                      cand={w}
                      idx={i}
                      len={waiting.length}
                      dept={d.code}
                      store={store}
                      act={act}
                      expanded={!!expanded[w.id]}
                      onToggle={() => setExpanded((e) => ({ ...e, [w.id]: !e[w.id] }))}
                    />
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>

      {adding && <AddCandidateModal store={store} dept={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function CandidateRow({
  cand, idx, len, dept, store, act, expanded, onToggle,
}: {
  cand: Candidate;
  idx: number;
  len: number;
  dept: DeptCode;
  store: FrontStore;
  act: (dept: DeptCode | null, fn: () => Promise<void>) => Promise<void>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const col = DEPT_COLOR[dept];
  const reorder = (action: 'top' | 'up' | 'down') => act(dept, () => store.reorder(dept, cand.id, action));
  return (
    <li className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`font-mono text-base font-black ${col.text}`}>{cand.number}</span>
          <span className="truncate font-bold">{cand.name}</span>
          <span className="truncate text-xs text-slate-400">{cand.gradeClass || cand.wechat || cand.mobile}</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <MiniBtn title="置顶" onClick={() => reorder('top')}>
            <Sparkles className="h-3.5 w-3.5" />
          </MiniBtn>
          <MiniBtn title="上移" disabled={idx === 0} onClick={() => reorder('up')}>
            <ArrowUp className="h-3.5 w-3.5" />
          </MiniBtn>
          <MiniBtn title="下移" disabled={idx === len - 1} onClick={() => reorder('down')}>
            <ArrowDown className="h-3.5 w-3.5" />
          </MiniBtn>
        </div>
      </div>
      {expanded && (
        <div className="mt-1.5 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
          <p>
            手机号 {cand.mobile}
            {cand.wechat ? ` · 微信 ${cand.wechat}` : ''}
            {cand.gradeClass ? ` · ${cand.gradeClass}` : ''}
            {!cand.wechat && !cand.gradeClass && ' · 面试官补录'}
          </p>
          <p>登记于 {new Date(cand.registeredAt).toLocaleString('zh-CN')}</p>
          {cand.note && <p>备注：{cand.note}</p>}
        </div>
      )}
    </li>
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
