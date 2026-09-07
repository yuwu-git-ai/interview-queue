import { useState, type ChangeEvent } from 'react';
import type { Candidate, DeptCode } from '@/shared/types';
import { DEPARTMENTS, DEPT_MAP, DEPT_COLOR, WAIT_ROOM } from '@/shared/constants';
import type { FrontStore, LookupCandidate } from '@/src/lib/store';
import { ArrowLeft, CheckCircle2, Search, Ticket } from 'lucide-react';

type Phase = 'form' | 'ticket' | 'query';

const inp =
  'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none';

export default function RegisterView({ store }: { store: FrontStore }) {
  const [phase, setPhase] = useState<Phase>('form');
  const [dept, setDept] = useState<DeptCode | ''>('');
  const [form, setForm] = useState({ name: '', mobile: '', wechat: '', gradeClass: '', note: '' });
  const [err, setErr] = useState('');
  const [ticket, setTicket] = useState<{ created: boolean; candidate: Candidate; ahead: number } | null>(null);
  const [results, setResults] = useState<LookupCandidate[]>([]);
  const [qMobile, setQMobile] = useState('');

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
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
      setResults(await store.lookup(mobile));
      setPhase('query');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  if (phase === 'query') {
    return (
      <div className="mx-auto max-w-md p-4">
        <BackBtn onClick={() => setPhase('form')} label="返回登记" />
        <h1 className="mb-3 text-xl font-bold">我的排队进度（{qMobile}）</h1>
        {err && <p className="mb-2 text-sm text-rose-600">{err}</p>}
        {results.length === 0 && <div className="rounded-xl bg-white p-6 text-center text-slate-400">未找到该手机号的记录</div>}
        <div className="space-y-2">
          {results.map((c) => {
            const d = DEPT_MAP[c.department];
            const col = DEPT_COLOR[c.department];
            const statusText = { waiting: '等待面试', interviewing: '面试中', completed: '已面试完', no_show: '已过号' }[c.status];
            return (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow">
                <div className="flex items-center justify-between">
                  <span className={`text-3xl font-black ${col.text}`}>{c.number}</span>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-sm font-bold ${
                      c.status === 'interviewing'
                        ? 'bg-rose-100 text-rose-700'
                        : c.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : c.status === 'waiting'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {statusText}
                  </span>
                </div>
                <p className="mt-1 text-slate-700">
                  {c.name} · {c.gradeClass}
                </p>
                <p className="text-sm text-slate-500">
                  {d.name} · 面试教室 {d.room}
                </p>
                {c.status === 'waiting' && c.ahead >= 0 && (
                  <p className="mt-2 font-bold text-slate-700">前方还有 {c.ahead} 人等待</p>
                )}
              </div>
            );
          })}
        </div>
        <QueryForm onQuery={doQuery} />
      </div>
    );
  }

  if (phase === 'ticket' && ticket) {
    const c = ticket.candidate;
    const d = DEPT_MAP[c.department];
    const col = DEPT_COLOR[c.department];
    return (
      <div className="mx-auto max-w-md p-4">
        <BackBtn onClick={() => setPhase('form')} label="再取一个号" />
        <div className={`overflow-hidden rounded-2xl border-t-8 bg-white shadow ${col.border}`}>
          <div className={`flex items-center gap-2 px-4 py-3 text-white ${col.bg}`}>
            <Ticket className="h-5 w-5" />
            {ticket.created ? '取号成功' : '您已取过号，找回凭条'}
          </div>
          <div className="p-5">
            <div className="text-center">
              <div className="text-sm text-slate-500">您的排队号码</div>
              <div className={`text-6xl font-black ${col.text}`}>{c.number}</div>
            </div>
            <dl className="mt-4 space-y-2 text-slate-700">
              <Row k="姓名" v={c.name} />
              <Row k="申请部门" v={d.name} />
              <Row k="面试教室" v={`${d.room}（候考室 ${WAIT_ROOM}）`} />
              <Row k="年级专业班级" v={c.gradeClass} />
              {c.status === 'waiting' ? (
                <Row k="前方等待" v={`${ticket.ahead >= 0 ? ticket.ahead : 0} 人`} />
              ) : (
                <Row k="当前状态" v="已进入面试/已完成" />
              )}
            </dl>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              请在候考室（教208）留意大屏叫号与语音播报，轮到您时前往对应教室。
            </div>
          </div>
        </div>
        <QueryForm onQuery={doQuery} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="text-xl font-bold">面试在线取号</h1>
      <p className="mb-3 text-sm text-slate-500">请先选择您要面试的部门</p>
      <div className="grid grid-cols-2 gap-2">
        {DEPARTMENTS.map((d) => {
          const waiting = store.state.candidates.filter((c) => c.department === d.code && c.status === 'waiting').length;
          const sel = dept === d.code;
          const col = DEPT_COLOR[d.code];
          return (
            <button
              key={d.code}
              onClick={() => setDept(d.code)}
              className={`rounded-2xl border-2 bg-white p-3 text-left shadow-sm transition ${sel ? `${col.border} ${col.soft}` : 'border-transparent'}`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white ${col.bg}`}>
                {d.code}
              </div>
              <div className="mt-2 font-bold">{d.name}</div>
              <div className="text-xs text-slate-500">教室 {d.room}</div>
              <div className="mt-1 text-xs font-bold text-slate-600">当前等待 {waiting} 人</div>
            </button>
          );
        })}
      </div>

      {dept && (
        <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow">
          <h2 className="font-bold">填写信息（{DEPT_MAP[dept].name}）</h2>
          <Field label="真实姓名 *">
            <input className={inp} value={form.name} onChange={set('name')} placeholder="请输入姓名" />
          </Field>
          <Field label="11 位手机号 *">
            <input className={inp} inputMode="numeric" maxLength={11} value={form.mobile} onChange={set('mobile')} placeholder="用于进度查询与找回凭条" />
          </Field>
          <Field label="微信号 *">
            <input className={inp} value={form.wechat} onChange={set('wechat')} placeholder="请输入微信号" />
          </Field>
          <Field label="年级与专业班级 *">
            <input className={inp} value={form.gradeClass} onChange={set('gradeClass')} placeholder="如：计科2201 / 机械2402" />
          </Field>
          <Field label="个人经历及特长（选填）">
            <textarea className={`${inp} min-h-20`} value={form.note} onChange={set('note')} placeholder="简要描述经历或特长" />
          </Field>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button
            onClick={submit}
            disabled={!dept || !form.name || !/^1[3-9]\d{9}$/.test(form.mobile) || !form.wechat || !form.gradeClass}
            className="w-full rounded-xl bg-blue-600 py-3 text-lg font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
          >
            提交取号
          </button>
        </div>
      )}

      <QueryForm onQuery={doQuery} />
    </div>
  );
}

const Field = ({ label, children }: any) => (
  <label className="block text-sm font-semibold text-slate-700">
    {label}
    <div className="mt-1">{children}</div>
  </label>
);
const Row = ({ k, v }: any) => (
  <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
    <dt className="text-slate-400">{k}</dt>
    <dd className="font-bold">{v}</dd>
  </div>
);
const BackBtn = ({ onClick, label }: any) => (
  <button onClick={onClick} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
    <ArrowLeft className="h-4 w-4" />
    {label}
  </button>
);

function QueryForm({ onQuery }: { onQuery: (mobile: string) => void }) {
  const [m, setM] = useState('');
  return (
    <div className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-3 shadow">
      <Search className="h-5 w-5 text-slate-400" />
      <input
        className="min-w-0 flex-1 border-0 bg-transparent outline-none"
        placeholder="输入手机号查排队进度"
        inputMode="numeric"
        maxLength={11}
        value={m}
        onChange={(e) => setM(e.target.value)}
      />
      <button
        onClick={() => onQuery(m)}
        disabled={!/^1[3-9]\d{9}$/.test(m)}
        className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        查询
      </button>
    </div>
  );
}
