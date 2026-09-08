import type { AppState, Candidate, DeptCode } from '@/shared/types';
import type { Judgment } from '@/shared/types';
import { registerCandidate, addCandidate, advanceSession, callCandidates, recall, reorder, completeInterview, addComment, setJudgment, removeCandidate, createEmptyState, hydrateState, waitingList, type RegisterInput, type StaffAddInput } from '@/shared/engine';

const LS_KEY = 'interview_queue_state_v1';
const LS_LOCAL_PW = 'iq_local_pw';

/** 候选人 + 前方等待人数（仅 waiting 时有意义） */
export type LookupCandidate = Candidate & { ahead: number };

export interface FrontStore {
  kind: 'server' | 'local';
  state: AppState;
  subscribe(fn: () => void): () => void;
  refresh(): Promise<void>;
  register(input: RegisterInput & { department: DeptCode }): Promise<{ created: boolean; candidate: Candidate; ahead: number }>;
  staffRegister(input: StaffAddInput): Promise<Candidate>;
  startNewSession(): Promise<void>;
  lookup(mobile: string): Promise<LookupCandidate[]>;
  login(pw: string): Promise<string>;
  call(dept: DeptCode, ids: string[]): Promise<void>;
  recall(dept: DeptCode): Promise<void>;
  reorder(dept: DeptCode, candidateId: string, action: 'top' | 'up' | 'down'): Promise<void>;
  complete(candidateId: string): Promise<void>;
  comment(candidateId: string, text: string): Promise<void>;
  judge(candidateId: string, judgment: Judgment | null): Promise<void>;
  remove(candidateId: string): Promise<void>;
}

/** 探测后端可用性 */
async function probeServer(base = '/api'): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** ServerStore：REST + 轮询（由 App 定时 refresh）。state 经 holder 可变，getter 实时暴露 */
function createServerStore(): FrontStore {
  const holder: { state: AppState } = { state: createEmptyState() };
  let token = sessionStorage.getItem('iq_token') || '';
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  const call = async (path: string, method = 'GET', body?: unknown) => {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.error || `请求失败(${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  };

  const setToken = (t: string) => {
    token = t;
    sessionStorage.setItem('iq_token', t);
  };
  const refreshNow = async () => {
    holder.state = await call('/api/state');
    emit();
  };

  return {
    kind: 'server',
    get state() {
      return holder.state;
    },
    subscribe: (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    refresh: refreshNow,
    register: async (input) => {
      const r = await call('/api/register', 'POST', input);
      await refreshNow();
      return r;
    },
    staffRegister: async (input) => {
      const r = await call('/api/interviewer/register', 'POST', input);
      await refreshNow();
      return r.candidate;
    },
    startNewSession: async () => {
      await call('/api/interviewer/new-session', 'POST', {});
      await refreshNow();
    },
    lookup: async (mobile) => call(`/api/lookup?mobile=${encodeURIComponent(mobile)}`),
    login: async (pw) => {
      const r = await call('/api/interviewer/login', 'POST', { password: pw });
      setToken(r.token);
      return r.token;
    },
    call: async (dept, ids) => {
      await call('/api/interviewer/call', 'POST', { department: dept, ids });
      await refreshNow();
    },
    recall: async (dept) => {
      await call('/api/interviewer/recall', 'POST', { department: dept });
      await refreshNow();
    },
    reorder: async (dept, candidateId, action) => {
      await call('/api/interviewer/reorder', 'POST', { department: dept, candidateId, action });
      await refreshNow();
    },
    complete: async (candidateId) => {
      await call('/api/interviewer/complete', 'POST', { candidateId });
      await refreshNow();
    },
    comment: async (candidateId, text) => {
      await call('/api/interviewer/comment', 'POST', { candidateId, text });
      await refreshNow();
    },
    judge: async (candidateId, judgment) => {
      await call('/api/interviewer/judgment', 'POST', { candidateId, judgment });
      await refreshNow();
    },
    remove: async (candidateId) => {
      await call('/api/interviewer/remove', 'POST', { candidateId });
      await refreshNow();
    },
  };
}

/** LocalStore：localStorage + BroadcastChannel 同机标签页联动（演示/降级） */
function createLocalStore(): FrontStore {
  const holder: { state: AppState } = { state: loadLocal() };
  const subs = new Set<() => void>();
  const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('iq-sync') : null;
  const emit = () => subs.forEach((f) => f());
  const persist = () => localStorage.setItem(LS_KEY, JSON.stringify(holder.state));

  function loadLocal(): AppState {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return hydrateState(JSON.parse(raw) as AppState);
    } catch {
      /* ignore */
    }
    return createEmptyState();
  }

  if (chan) {
    chan.onmessage = (e) => {
      if (e.data?.revision !== holder.state.revision) {
        holder.state = e.data.state;
        emit();
      }
    };
  }

  const bump = (next: AppState) => {
    holder.state = next;
    persist();
    emit();
    if (chan) chan.postMessage({ revision: holder.state.revision, state: holder.state });
  };

  /** 前方真正在等人数（与 server aheadOf 语义一致） */
  const aheadOfLocal = (c: Candidate): number => {
    if (c.status !== 'waiting') return -1;
    const idx = waitingList(holder.state, c.department).findIndex((x) => x.id === c.id);
    return idx === -1 ? -1 : idx;
  };

  return {
    kind: 'local',
    get state() {
      return holder.state;
    },
    subscribe: (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    refresh: async () => {
      /* no-op，本地即时 */
    },
    register: async (input) => {
      const r = registerCandidate(holder.state, input);
      if (r.created) {
        bump(r.state);
      } else {
        holder.state = r.state;
        emit();
      }
      return { created: r.created, candidate: r.candidate, ahead: aheadOfLocal(r.candidate) };
    },
    staffRegister: async (input) => {
      const r = addCandidate(holder.state, input);
      bump(r.state);
      return r.candidate;
    },
    startNewSession: async () => {
      bump(advanceSession(holder.state));
    },
    lookup: async (mobile) =>
      holder.state.candidates
        .filter((c) => c.mobile === mobile)
        .map((c) => ({ ...c, ahead: aheadOfLocal(c) })),
    login: async (pw) => {
      if (pw !== (localStorage.getItem(LS_LOCAL_PW) || '123')) throw Object.assign(new Error('密码错误'), { status: 401 });
      return 'local-token';
    },
    call: async (dept, ids) => {
      bump(callCandidates(holder.state, dept, ids));
    },
    recall: async (dept) => {
      bump(recall(holder.state, dept));
    },
    reorder: async (dept, candidateId, action) => {
      bump(reorder(holder.state, dept, candidateId, action));
    },
    complete: async (candidateId) => {
      bump(completeInterview(holder.state, candidateId));
    },
    comment: async (candidateId, text) => {
      bump(addComment(holder.state, candidateId, text));
    },
    judge: async (candidateId, judgment) => {
      bump(setJudgment(holder.state, candidateId, judgment));
    },
    remove: async (candidateId) => {
      bump(removeCandidate(holder.state, candidateId));
    },
  };
}

let cached: FrontStore | null = null;

/** 启动时探测一次后端；可用 → ServerStore，不可用 → LocalStore（降级演示） */
export async function getStore(): Promise<FrontStore> {
  if (cached) return cached;
  const ok = await probeServer();
  cached = ok ? createServerStore() : createLocalStore();
  return cached;
}
