import { useState, type ChangeEvent } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, ClipboardList, MapPin, Search, Ticket, Users } from 'lucide-react';
import type { Candidate, DeptCode } from '@/shared/types';
import { DEPT_MAP, DEPT_COLOR } from '@/shared/constants';
import { waitRoomOf, activeDepartments, waitingList } from '@/shared/engine';
import type { FrontStore, LookupCandidate } from '@/src/lib/store';

type Phase = 'dept' | 'form' | 'ticket' | 'query';

const inp =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function RegisterView({ store }: { store: FrontStore }) {
  const [phase, setPhase] = useState<Phase>('dept');
  const [dept, setDept] = useState<DeptCode | ''>('');
  const [form, setForm] = useState({ name: '', mobile: '', wechat: '', gradeClass: '' });
  const [err, setErr] = useState('');
  const [ticket, setTicket] = useState<{ created: boolean; candidate: Candidate; ahead: number } | null>(null);
  const [results, setResults] = useState<LookupCandidate[]>([]);
  const [qMobile, setQMobile] = useState('');

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!dept) return;
    setErr('');
    try {
      const r = await store.register({ department: dept as DeptCode, ...form });
      setTicket(r);
      setPhase('ticket');
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function doQuery(mobile: string) {
    setErr('');
    setQMobile(mobile);
    try {
      setResults(mobile ? await store.lookup(mobile) : []);
      setPhase('query');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className={`min-h-full bg-slate-100 ${phase === 'dept' ? 'pb-28' : 'pb-10'}`}>
      {/* 顶部品牌条 */}
      <div className="bg-slate-900 pb-14 pt-4">
        <div className="mx-auto flex max-w-md items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-900/30">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">面试在线取号</h1>
              <p className="text-xs text-slate-300">等候室 {waitRoomOf(store.state)} · 扫码报到</p>
            </div>
          </div>
          {/* 任意阶段都可点入进度查询 */}
          {phase !== 'query' && (
            <button
              onClick={() => doQuery('')}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/10"
            >
              <Search className="h-3.5 w-3.5" />
              查进度
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-md px-4">
        {phase === 'dept' && (
          <DeptStep
            store={store}
            selected={dept}
            onSelect={(d) => {
              setDept(d);
              setPhase('form');
            }}
          />
        )}

        {phase === 'form' && dept && (
          <FormStep
            dept={dept}
            room={(store.state.departments[dept] || DEPT_MAP[dept]).room}
            form={form}
            set={set}
            err={err}
            onBack={() => setPhase('dept')}
            onSubmit={submit}
          />
        )}

        {phase === 'ticket' && ticket && (
          <TicketView store={store} ticket={ticket} onAgain={() => setPhase('dept')} onQuery={doQuery} />
        )}

        {phase === 'query' && (
          <QueryView
            mobile={qMobile}
            results={results}
            err={err}
            onBack={() => setPhase('dept')}
            onQuery={doQuery}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- 步骤一：选部门 ---------- */
function DeptStep({
  store, selected, onSelect,
}: {
  store: FrontStore;
  selected: DeptCode | '';
  onSelect: (d: DeptCode) => void;
}) {
  return (
    <div>
      <Card title="选择面试部门" subtitle="请选择您要面试的部门，领取对应序号">
        <ul className="space-y-2.5">
          {activeDepartments(store.state).map((d) => {
            const waiting = store.state.candidates.filter((c) => c.department === d.code && c.status === 'waiting').length;
            const col = DEPT_COLOR[d.code];
            const sel = selected === d.code;
            return (
              <li key={d.code}>
                <button
                  onClick={() => onSelect(d.code)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.98] ${
                    sel ? `${col.border} ring-2 ${col.soft}` : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl font-black text-white ${col.bg}`}>
                    {d.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-black text-slate-800">{d.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      面试室 {d.room}
                    </span>
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      waiting ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <Users className="h-3 w-3" />
                    {waiting ? `${waiting} 人等待` : '无需等待'}
                  </span>
                  {sel && <CheckCircle2 className={`h-5 w-5 shrink-0 ${col.text}`} />}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <HintNote waitRoom={waitRoomOf(store.state)} />
    </div>
  );
}

/* ---------- 步骤二：填表 ---------- */
function FormStep({
  dept, room, form, set, err, onBack, onSubmit,
}: {
  dept: DeptCode;
  room: string;
  form: { name: string; mobile: string; wechat: string; gradeClass: string };
  set: (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  err: string;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const d = DEPT_MAP[dept];
  const col = DEPT_COLOR[dept];
  const valid =
    !!form.name && /^1[3-9]\d{9}$/.test(form.mobile) && !!form.wechat && !!form.gradeClass;

  return (
    <Card title="填写报名信息" subtitle={`已选部门：${d.name} · 面试室 ${room}`}>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        重新选择部门
      </button>
      <div className="space-y-4">
        <Field label="真实姓名" required>
          <input className={inp} value={form.name} onChange={set('name')} placeholder="请输入姓名" />
        </Field>
        <Field label="手机号" required hint="11 位，用于进度查询与找回凭条">
          <input className={inp} inputMode="numeric" maxLength={11} value={form.mobile} onChange={set('mobile')} placeholder="请输入 11 位手机号" />
        </Field>
        <Field label="微信号" required>
          <input className={inp} value={form.wechat} onChange={set('wechat')} placeholder="请输入微信号" />
        </Field>
        <Field label="年级与专业班级" required>
          <input className={inp} value={form.gradeClass} onChange={set('gradeClass')} placeholder="如：25电子商务" />
        </Field>
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{err}</p>}

        <button
          onClick={onSubmit}
          disabled={!valid}
          className="w-full rounded-xl py-3.5 text-lg font-bold text-white shadow-md shadow-blue-600/20 transition active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
          style={{ background: valid ? '#2563eb' : undefined }}
        >
          提交取号
        </button>
      </div>
    </Card>
  );
}

/* ---------- 凭条 ---------- */
function TicketView({
  store, ticket, onAgain, onQuery,
}: {
  store: FrontStore;
  ticket: { created: boolean; candidate: Candidate; ahead: number };
  onAgain: () => void;
  onQuery: (mobile: string) => void;
}) {
  const c = ticket.candidate;
  const d = store.state.departments[c.department] || DEPT_MAP[c.department];
  const col = DEPT_COLOR[c.department];

  // 实时状态：尽量从当前轮询到的 state 里找这条记录
  const live = store.state.candidates.find((x) => x.id === c.id) || c;
  const waitingNow = live.status === 'waiting' ? waitingList(store.state, c.department).findIndex((x) => x.id === live.id) : -1;
  const statusText =
    live.status === 'interviewing'
      ? '面试中'
      : live.status === 'completed'
        ? '已面试完'
        : live.status === 'no_show'
          ? '已过号'
          : '等待面试';

  const statusColor =
    live.status === 'interviewing'
      ? 'bg-rose-100 text-rose-600'
      : live.status === 'completed'
        ? 'bg-emerald-100 text-emerald-600'
        : live.status === 'no_show'
          ? 'bg-slate-200 text-slate-500'
          : 'bg-amber-100 text-amber-700';

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-300/40">
      {/* 票头 */}
      <div className={`relative px-5 py-4 text-white ${col.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            <span className="text-sm font-bold">{ticket.created ? '取号成功' : '已取号 · 凭条找回'}</span>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusColor}`}>{statusText}</span>
        </div>
        <p className="mt-1 text-xs opacity-80">
          {d.name} · 面试室 {d.room}
        </p>
      </div>

      {/* 主号区 */}
      <div className="px-5 pt-5 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">排队号码</p>
        <p className={`mt-1 text-7xl font-black leading-none ${col.text}`}>{c.number}</p>
        <p className="mt-2 text-slate-600">
          {c.name} · {c.gradeClass}
        </p>
        {live.status === 'waiting' ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1 text-sm font-bold text-white">
            <Users className="h-4 w-4" />
            前方还有 {waitingNow >= 0 ? waitingNow : 0} 人等待
          </p>
        ) : (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1 text-sm font-bold text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            当前状态：{statusText}
          </p>
        )}
      </div>

      {/* 虚线分隔 + 二维码占位孔 */}
      <div className="relative my-4">
        <div className="mx-4 border-t-2 border-dashed border-slate-200" />
        <span className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full ${col.bg}`} />
      </div>

      <div className="px-5 pb-4">
        <dl className="space-y-2 text-sm">
          <InfoRow k="年级专业班级" v={c.gradeClass} />
          <InfoRow k="微信号" v={c.wechat} />
          <InfoRow k="手机号" v={maskMobile(c.mobile)} />
        </dl>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 px-3.5 py-3 text-xs leading-relaxed text-blue-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            请在等候室（{waitRoomOf(store.state)}）留意大屏叫号与语音播报。
            <br />
            轮到您时，请前往上方对应的面试室参加面试。
          </span>
        </div>

        <button
          onClick={onAgain}
          className="mt-4 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          为他人再取一个号
        </button>
      </div>

      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
        <button onClick={() => onQuery(c.mobile)} className="flex w-full items-center justify-between py-1 text-sm font-bold text-blue-600">
          <span>查看我的排队进度</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- 进度查询结果 ---------- */
function QueryView({
  results, err, mobile, onBack, onQuery,
}: {
  results: LookupCandidate[];
  err: string;
  mobile: string;
  onBack: () => void;
  onQuery: (mobile: string) => void;
}) {
  return (
    <Card title="我的排队进度" subtitle={mobile ? `手机号 ${mobile}` : '输入手机号可查看排队状态'}>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        返回取号
      </button>
      {err && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>}
      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
          {mobile ? '未找到该手机号的记录' : '在下方输入手机号查询排队进度'}
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((c) => {
            const d = DEPT_MAP[c.department];
            const col = DEPT_COLOR[c.department];
            const statusText =
              c.status === 'interviewing' ? '面试中' : c.status === 'completed' ? '已面试完' : c.status === 'no_show' ? '已过号' : '等待面试';
            const statusColor =
              c.status === 'interviewing'
                ? 'bg-rose-100 text-rose-700'
                : c.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : c.status === 'no_show'
                    ? 'bg-slate-200 text-slate-600'
                    : 'bg-amber-100 text-amber-700';
            return (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-black ${col.text}`}>{c.number}</span>
                    <span className="text-sm font-bold text-slate-700">{c.name}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColor}`}>{statusText}</span>
                </div>
                <p className="mt-1.5 text-sm font-bold text-slate-600">{d.name}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {c.gradeClass} · 面试室 {d.room}
                </p>
                {c.status === 'waiting' && c.ahead >= 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-slate-700">
                    <Users className="h-4 w-4 text-amber-500" />
                    前方还有 {c.ahead} 人等待
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <QueryInput onQuery={onQuery} />
    </Card>
  );
}

/* ---------- 小部件 ---------- */
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/60">
      <h2 className="text-lg font-black text-slate-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label, required, optional, hint, children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
        {optional && <span className="ml-1.5 text-xs font-normal text-slate-400">（选填）</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function maskMobile(m: string): string {
  return m.length === 11 ? `${m.slice(0, 3)}****${m.slice(7)}` : m;
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5 last:border-0">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-bold text-slate-700">{v}</dd>
    </div>
  );
}

function HintNote({ waitRoom }: { waitRoom: string }) {
  return (
    <p className="mt-4 px-2 text-center text-xs leading-relaxed text-slate-400">
      每人每部门限取一个号。
      <br />
      取号后请在等候室（{waitRoom}）留意大屏叫号。
    </p>
  );
}

function QueryInput({ onQuery, compact = false }: { onQuery: (mobile: string) => void; compact?: boolean }) {
  const [m, setM] = useState('');
  return (
    <div className={compact ? '' : 'mt-5'}>
      {!compact && <p className="mb-2 text-sm font-bold text-slate-700">查询排队进度</p>}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-base outline-none placeholder:text-slate-400"
          placeholder="输入 11 位手机号查进度"
          inputMode="numeric"
          maxLength={11}
          value={m}
          onChange={(e) => setM(e.target.value)}
        />
        <button
          onClick={() => onQuery(m)}
          disabled={!/^1[3-9]\d{9}$/.test(m)}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition disabled:opacity-30"
        >
          查询
        </button>
      </div>
    </div>
  );
}

