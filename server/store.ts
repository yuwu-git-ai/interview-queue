import fs from 'node:fs';
import path from 'node:path';
import type { AppState, Candidate, DeptCode, Judgment } from '../shared/types';
import {
  createEmptyState, registerCandidate, addCandidate as engAddCandidate, callCandidates as engCallCandidates, recall as engRecall,
  reorder as engReorder, completeInterview as engComplete, addComment as engAddComment, setJudgment as engSetJudgment,
  removeCandidate as engRemove, advanceSession as engAdvanceSession, hydrateState, waitingList, type RegisterInput, type StaffAddInput, type ReorderAction,
} from '../shared/engine';

export interface RegisterResult { created: boolean; candidate: Candidate; }

/** 某候选人在其部门内"前方真正在等的人数"（interviewing/completed 不计；非 waiting 返回 -1） */
export function aheadOf(state: AppState, c: Candidate): number {
  if (c.status !== 'waiting') return -1;
  const idx = waitingList(state, c.department).findIndex((x) => x.id === c.id);
  return idx === -1 ? -1 : idx;
}

function save(state: AppState, file: string) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file); // 原子替换
}

function load(file: string): AppState {
  if (!fs.existsSync(file)) return createEmptyState();
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as AppState;
    return hydrateState(raw); // 兼容无 场次/归档 字段的旧状态
  } catch (e) {
    console.error('[store] 状态文件损坏，用空状态兜底:', e);
    return createEmptyState();
  }
}

export interface ServerStore {
  getState(): AppState;
  persist(): void;
  overwrite(next: AppState): void;
  register(input: RegisterInput): RegisterResult;
  add(input: StaffAddInput): Candidate;
  advanceSession(): AppState;
  call(department: DeptCode, ids: string[]): AppState;
  recall(department: DeptCode): AppState;
  reorder(department: DeptCode, candidateId: string, action: ReorderAction): AppState;
  complete(candidateId: string): AppState;
  addComment(candidateId: string, text: string): AppState;
  setJudgment(candidateId: string, judgment: Judgment | null): AppState;
  remove(candidateId: string): AppState;
  lookupByMobile(mobile: string): Candidate[];
  verifyPassword(pw: string): boolean;
}

export function createServerStore(file = process.env.STATE_FILE || './data/state.json'): ServerStore {
  let state = load(file);

  const commit = (next: AppState) => { state = next; save(state, file); };

  const api: ServerStore = {
    getState: () => state,
    persist: () => save(state, file),
    overwrite: (next) => { state = next; save(state, file); },
    register: (input) => {
      const { state: next, created, candidate } = registerCandidate(state, input);
      if (created) commit(next);
      return { created, candidate };
    },
    // 面试官补录：引擎已对同手机号本部门未完成抛错，能走到这里即为新建
    add: (input) => {
      const r = engAddCandidate(state, input);
      commit(r.state);
      return r.candidate;
    },
    // 开启新一天：归档当天→已过号收尾、清空看板，号码重排
    advanceSession: () => {
      const next = engAdvanceSession(state);
      commit(next);
      return state;
    },
    call: (department, ids) => { const next = engCallCandidates(state, department, ids); commit(next); return state; },
    recall: (department) => { const next = engRecall(state, department); if (next !== state) commit(next); return state; },
    reorder: (department, candidateId, action) => { const next = engReorder(state, department, candidateId, action); if (next !== state) commit(next); return state; },
    complete: (candidateId) => { const next = engComplete(state, candidateId); if (next !== state) commit(next); return state; },
    addComment: (candidateId, text) => { const next = engAddComment(state, candidateId, text); commit(next); return state; },
    setJudgment: (candidateId, judgment) => { const next = engSetJudgment(state, candidateId, judgment); commit(next); return state; },
    remove: (candidateId) => { const next = engRemove(state, candidateId); if (next !== state) commit(next); return state; },
    lookupByMobile: (mobile) => state.candidates.filter((c) => c.mobile === mobile),
    verifyPassword: (pw) => pw === (process.env.INTERVIEWER_PASSWORD || '123'),
  };
  return api;
}
