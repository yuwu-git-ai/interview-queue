import type { AppState, Announcement, Candidate, Department, DeptCode, Judgment, Status } from './types';
import { DEPT_MAP, DEPARTMENTS, MOBILE_RE, NUMBER_PAD, MAX_ANNOUNCEMENTS } from './constants';

/** 浏览器与 Node 双兼容的 uuid（不用 node:crypto，避免打浏览器包报错） */
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface RegisterInput {
  department: DeptCode;
  name: string;
  mobile: string;
  wechat: string;
  gradeClass: string;
  note?: string;
  now?: number;
}

export function createEmptyState(): AppState {
  const departments = Object.fromEntries(DEPARTMENTS.map((d) => [d.code, { ...d }])) as Record<DeptCode, Department>;
  return {
    revision: 0,
    departments,
    currentSession: 1,
    candidates: [],
    archive: [],
    queueOrder: { A: [], B: [], C: [], D: [] },
    announcements: [],
    counters: { A: 0, B: 0, C: 0, D: 0 },
    stats: { total: 0, interviewing: 0, waiting: 0, completed: 0 },
  };
}

/** epoch ms → 'YYYY-MM-DD'（本地时区），用于场次/历史标记 */
export function dayOf(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 兼容旧数据：给缺 场次/日期 的记录补齐默认（现场即视为当前场次，用登记时间补日期） */
export function hydrateState(raw: AppState): AppState {
  const cur = typeof raw.currentSession === 'number' && raw.currentSession > 0 ? raw.currentSession : 1;
  const fill = (c: Candidate, defSession: number): Candidate => ({
    ...c,
    session: c.session ?? defSession,
    day: c.day || dayOf(c.registeredAt || Date.now()),
    comments: Array.isArray(c.comments) ? c.comments : [],
  });
  return {
    ...raw,
    currentSession: cur,
    candidates: Array.isArray(raw.candidates) ? raw.candidates.map((c) => fill(c, cur)) : [],
    archive: Array.isArray(raw.archive) ? raw.archive.map((c) => fill(c, 1)) : [],
  };
}

function pad(seq: number): string {
  return String(seq).padStart(NUMBER_PAD, '0');
}

function withStats(s: AppState): AppState {
  s.stats = { total: 0, interviewing: 0, waiting: 0, completed: 0 };
  for (const c of s.candidates) {
    s.stats.total += 1;
    if (c.status === 'interviewing') s.stats.interviewing += 1;
    else if (c.status === 'waiting') s.stats.waiting += 1;
    else if (c.status === 'completed') s.stats.completed += 1;
  }
  return s;
}

/** 纯深拷贝，避免污染传入的 state；每次结构变更 revision+1 */
function clone(s: AppState): AppState {
  const next: AppState = JSON.parse(JSON.stringify(s));
  next.revision += 1;
  return next;
}

function pushAnnouncement(s: AppState, type: Announcement['type'], department: DeptCode, anchorId: string | null, text: string, now: number) {
  s.announcements.push({
    id: s.announcements.length ? s.announcements[s.announcements.length - 1].id + 1 : 1,
    type,
    department,
    candidateId: anchorId ?? '',
    text,
    at: now,
  });
  if (s.announcements.length > MAX_ANNOUNCEMENTS) s.announcements = s.announcements.slice(-MAX_ANNOUNCEMENTS);
}

/** 面试官补录入参：部门+姓名+手机号必填，微信/班级可选 */
export interface StaffAddInput {
  department: DeptCode;
  name: string;
  mobile: string;
  wechat?: string;
  gradeClass?: string;
  note?: string;
  now?: number;
}

/** 入队共用（不校验微信/班级是否必填）：查重 → 分配序号 → 入队 */
function enqueue(s: AppState, input: StaffAddInput): { state: AppState; created: boolean; candidate: Candidate; existing?: Candidate } {
  const { department, name, mobile, wechat = '', gradeClass = '', note = '', now = Date.now() } = input;
  if (!DEPT_MAP[department]) throw new Error('部门不存在');
  if (!name?.trim()) throw new Error('请输入姓名');
  if (!MOBILE_RE.test(mobile)) throw new Error('请输入正确的 11 位手机号');

  const unfinished = s.candidates.find(
    (c) => c.department === department && c.mobile === mobile &&
      (c.status === 'waiting' || c.status === 'interviewing')
  );
  if (unfinished) {
    // 重复登记：不产生任何变更（revision 不变），返回已有记录
    return { state: s, created: false, candidate: unfinished, existing: unfinished };
  }

  const next = clone(s);
  const seq = next.counters[department] + 1;
  next.counters[department] = seq;
  const id = uuid();
  const candidate: Candidate = {
    id, department, number: `${department}${pad(seq)}`, seq,
    session: s.currentSession, day: dayOf(now),
    name: name.trim(), mobile, wechat: wechat.trim(), gradeClass: gradeClass.trim(),
    note: note.trim(), comments: [], status: 'waiting', callCount: 0,
    registeredAt: now,
  };
  next.candidates.push(candidate);
  next.queueOrder[department].push(id);
  return { state: withStats(next), created: true, candidate };
}

/**
 * 开启新一天：把当天全部在册记录归档进 history 备查；
 * 未面试完的（等待/面试中）按“已过号”收尾，已完成的保持完成。
 * 清空看板/叫号/统计，号码从 A01 重新排（currentSession + 1）。
 */
export function advanceSession(s: AppState, now: number = Date.now()): AppState {
  const next = clone(s);
  const archived: Candidate[] = next.candidates.map((c) =>
    c.status === 'waiting' || c.status === 'interviewing'
      ? { ...c, status: 'no_show' as Status, interviewEndedAt: c.interviewEndedAt ?? now }
      : c
  );
  next.archive = next.archive.concat(archived);
  next.candidates = [];
  next.queueOrder = { A: [], B: [], C: [], D: [] };
  next.counters = { A: 0, B: 0, C: 0, D: 0 };
  next.announcements = [];
  next.currentSession += 1;
  next.stats = { total: 0, interviewing: 0, waiting: 0, completed: 0 };
  return next;
}

export function registerCandidate(s: AppState, input: RegisterInput): { state: AppState; created: boolean; candidate: Candidate; existing?: Candidate } {
  const { wechat, gradeClass } = input;
  if (!wechat?.trim()) throw new Error('请输入微信号');
  if (!gradeClass?.trim()) throw new Error('请输入年级与专业班级');
  return enqueue(s, input);
}

/** 面试官补录：仅需 部门+姓名+手机号，微信/班级选填；同手机号本部门未完成时抛错提示 */
export function addCandidate(s: AppState, input: StaffAddInput): { state: AppState; candidate: Candidate } {
  const r = enqueue(s, input);
  if (!r.created && r.existing) {
    throw new Error(`该手机号在${DEPT_MAP[r.existing.department].name}已有登记（${r.existing.number}），无需补录`);
  }
  return { state: r.state, candidate: r.candidate };
}

/** 组公告文本：A02号 张三、A05号 李四 同学，请前往 事业部（教214） 参加面试 */
export function buildGroupText(list: Candidate[]): string {
  const d = DEPT_MAP[list[0].department];
  const who = list.map((c) => `${c.number}号 ${c.name}`).join('、');
  return `${who} 同学，请前往 ${d.name}（${d.room}） 参加面试`;
}

/**
 * 选人叫号（可一组多人同时面试）：
 * 所选必须都属该部门且在等待中；若部门当前已有未完成面试者则拒绝，
 * 由面试官逐位“完成”后再叫下一组——避免两组/两部门叫号互相覆盖冲突。
 */
export function callCandidates(s: AppState, department: DeptCode, ids: string[], now: number = Date.now()): AppState {
  const uniq = Array.from(new Set(ids || []));
  if (uniq.length === 0) throw new Error('请先勾选要叫号的面试者');
  const rows = uniq.map((id) => s.candidates.find((c) => c.id === id));
  if (rows.some((c) => !c || c.department !== department)) throw new Error('所选面试者不属于该部门，请刷新后重试');
  if (rows.some((c) => c!.status !== 'waiting')) throw new Error('所选面试者中有不在等待中的（可能刚被叫或已完成），请刷新');
  if (s.candidates.some((c) => c.department === department && c.status === 'interviewing'))
    throw new Error('该部门仍有未完成的面试者，请先点“完成”再叫下一组');

  const next = clone(s);
  for (const id of uniq) {
    const c = next.candidates.find((x) => x.id === id)!;
    c.status = 'interviewing';
    if (!c.interviewStartedAt) c.interviewStartedAt = now;
    c.callCount += 1;
  }
  const chosen = uniq.map((id) => next.candidates.find((c) => c.id === id)!);
  pushAnnouncement(next, 'call', department, uniq[0], buildGroupText(chosen), now);
  return withStats(next);
}

/** 对当前部门正在面试的整组“再叫一遍”（催场），支持一次多人群呼 */
export function recall(s: AppState, department: DeptCode, now: number = Date.now()): AppState {
  const group = s.candidates.filter((c) => c.department === department && c.status === 'interviewing');
  if (!group.length) return s;
  const next = clone(s);
  pushAnnouncement(next, 'recall', department, group[0].id, buildGroupText(group), now);
  return next;
}

export type ReorderAction = 'top' | 'up' | 'down';

export function reorder(s: AppState, department: DeptCode, candidateId: string, action: ReorderAction, _now: number = Date.now()): AppState {
  const next = clone(s);
  const order = next.queueOrder[department];
  const idx = order.indexOf(candidateId);
  if (idx < 0) return s;
  const target = next.candidates.find((c) => c.id === candidateId);
  if (!target || target.status !== 'waiting') return s;
  const [item] = order.splice(idx, 1);
  let dest = idx;
  if (action === 'top') dest = 0;
  else if (action === 'up') dest = Math.max(0, idx - 1);
  else if (action === 'down') dest = Math.min(order.length, idx + 1);
  order.splice(dest, 0, item);
  return next;
}

export function completeInterview(s: AppState, candidateId: string, now: number = Date.now()): AppState {
  const next = clone(s);
  const c = next.candidates.find((x) => x.id === candidateId);
  if (!c || c.status !== 'interviewing') return s;
  c.status = 'completed';
  c.interviewEndedAt = now;
  c.result = 'pending';
  return withStats(next);
}

/** 删除一条候选人记录（当前队列或历史归档均可）：从看板/队列/名单中移除，号码不复用。找不到则原样返回。 */
export function removeCandidate(s: AppState, candidateId: string): AppState {
  const next = clone(s);
  const li = next.candidates.findIndex((c) => c.id === candidateId);
  if (li >= 0) {
    const [c] = next.candidates.splice(li, 1);
    const q = next.queueOrder[c.department] || [];
    const qi = q.indexOf(candidateId);
    if (qi >= 0) q.splice(qi, 1);
    return withStats(next);
  }
  const ai = next.archive.findIndex((c) => c.id === candidateId);
  if (ai >= 0) {
    next.archive.splice(ai, 1);
    return next;
  }
  return s; // 已被删/不存在：revision 不变
}

/** 给某位候选人追加一条面试备注：多条共存、追加式，多位面试官同时写互不覆盖 */
export function addComment(s: AppState, candidateId: string, text: string, now: number = Date.now()): AppState {
  const t = (text || '').trim();
  if (!t) throw new Error('请输入备注内容');
  if (!s.candidates.some((x) => x.id === candidateId)) throw new Error('候选人不存在或已归档，无法备注');
  const next = clone(s);
  const cc = next.candidates.find((x) => x.id === candidateId)!;
  const list = cc.comments || [];
  cc.comments = [...list, { id: list.length ? list[list.length - 1].id + 1 : 1, text: t, at: now }];
  return next;
}

/** 设置 / 清除候选人的临时判断（后写覆盖；传 null 清除） */
export function setJudgment(s: AppState, candidateId: string, judgment: Judgment | null, _now: number = Date.now()): AppState {
  if (!s.candidates.some((x) => x.id === candidateId)) throw new Error('候选人不存在或已归档');
  const next = clone(s);
  const cc = next.candidates.find((x) => x.id === candidateId)!;
  if (judgment == null) delete cc.judgment;
  else cc.judgment = judgment;
  return next;
}

export function buildAnnouncementText(s: AppState, candidateId: string): string {
  const c = s.candidates.find((x) => x.id === candidateId)!;
  return buildGroupText([c]);
}

export function waitingList(s: AppState, department: DeptCode): Candidate[] {
  const set = new Map(s.candidates.map((c) => [c.id, c]));
  return (s.queueOrder[department] || [])
    .map((id) => set.get(id))
    .filter((c): c is Candidate => !!c && c.status === 'waiting');
}

export function listByStatus(s: AppState, department: DeptCode): Record<Status, Candidate[]> {
  const all = s.candidates.filter((c) => c.department === department);
  const waiting = waitingList(s, department);
  return {
    waiting,
    interviewing: all.filter((c) => c.status === 'interviewing'),
    completed: all.filter((c) => c.status === 'completed'),
    no_show: all.filter((c) => c.status === 'no_show'),
  };
}

export function findCandidateByMobile(s: AppState, mobile: string): Candidate | undefined {
  return s.candidates.find((c) => c.mobile === mobile);
}

export function statsOf(s: AppState): AppState['stats'] {
  return s.stats;
}
