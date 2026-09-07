import type { AppState, Announcement, Candidate, Department, DeptCode, Status } from './types';
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
    candidates: [],
    queueOrder: { A: [], B: [], C: [], D: [] },
    announcements: [],
    counters: { A: 0, B: 0, C: 0, D: 0 },
    stats: { total: 0, interviewing: 0, waiting: 0, completed: 0 },
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

function pushAnnouncement(s: AppState, type: Announcement['type'], candidateId: string, now: number) {
  s.announcements.push({
    id: s.announcements.length ? s.announcements[s.announcements.length - 1].id + 1 : 1,
    type,
    department: s.candidates.find((c) => c.id === candidateId)!.department,
    candidateId,
    text: buildAnnouncementText(s, candidateId),
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
    name: name.trim(), mobile, wechat: wechat.trim(), gradeClass: gradeClass.trim(),
    note: note.trim(), status: 'waiting', callCount: 0,
    registeredAt: now,
  };
  next.candidates.push(candidate);
  next.queueOrder[department].push(id);
  return { state: withStats(next), created: true, candidate };
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

export function callNext(s: AppState, department: DeptCode, now: number = Date.now()): AppState {
  const next = clone(s);
  const order = next.queueOrder[department];
  const current = next.candidates.find((c) => c.department === department && c.status === 'interviewing');
  const nextWaitingId = order.find((id) => next.candidates.find((c) => c.id === id)?.status === 'waiting');
  if (!nextWaitingId) return s; // 无人在等 → 不动作、revision 不变

  if (current) {
    current.status = 'completed';
    current.interviewEndedAt = now;
  }
  const chosen = next.candidates.find((c) => c.id === nextWaitingId)!;
  chosen.status = 'interviewing';
  chosen.interviewStartedAt = now;
  chosen.callCount += 1;
  pushAnnouncement(next, 'call', chosen.id, now);
  return withStats(next);
}

export function recall(s: AppState, department: DeptCode, now: number = Date.now()): AppState {
  const current = s.candidates.find((c) => c.department === department && c.status === 'interviewing');
  if (!current) return s;
  const next = clone(s);
  pushAnnouncement(next, 'recall', current.id, now);
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

export function buildAnnouncementText(s: AppState, candidateId: string): string {
  const c = s.candidates.find((x) => x.id === candidateId)!;
  const d = DEPT_MAP[c.department];
  return `${c.number}号 ${c.name} 同学，请前往 ${d.name}（${d.room}） 参加面试`;
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
