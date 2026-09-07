import type { AppState, Candidate, DeptCode } from '@/shared/types';
import { registerCandidate, callNext, recall, reorder, completeInterview, createEmptyState, waitingList, type RegisterInput } from '@/shared/engine';

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
  lookup(mobile: string): Promise<LookupCandidate[]>;
  login(pw: string): Promise<string>;
  callNext(dept: DeptCode): Promise<void>;
  recall(dept: DeptCode): Promise<void>;
  reorder(dept: DeptCode, candidateId: string, action: 'top' | 'up' | 'down'): Promise<void>;
  complete(candidateId: string): Promise<void>;
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

/** ServerStore：REST + 轮询（由 App 定时 refresh） */
function createServerStore(): FrontStore {
  let state: AppState = createEmptyState();
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
    state = await call('/api/state');
    emit();
  };

  return {
    kind: 'server',
    state,
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
    lookup: async (mobile) => call(`/api/lookup?mobile=${encodeURIComponent(mobile)}`),
    login: async (pw) => {
      const r = await call('/api/interviewer/login', 'POST', { password: pw });
      setToken(r.token);
      return r.token;
    },
    callNext: async (dept) => {
      await call('/api/interviewer/call-next', 'POST', { department: dept });
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
  };
}

/** LocalStore：localStorage + BroadcastChannel 同机标签页联动（演示/降级） */
function createLocalStore(): FrontStore {
  let state: AppState = loadLocal();
  const subs = new Set<() => void>();
  const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('iq-sync') : null;
  const emit = () => subs.forEach((f) => f());
  const persist = () => localStorage.setItem(LS_KEY, JSON.stringify(state));

  function loadLocal(): AppState {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as AppState;
    } catch {
      /* ignore */
    }
    return createEmptyState();
  }

  if (chan) {
    chan.onmessage = (e) => {
      if (e.data?.revision !== state.revision) {
        state = e.data.state;
        emit();
      }
    };
  }

  const bump = (next: AppState) => {
    state = next;
    persist();
    emit();
    if (chan) chan.postMessage({ revision: state.revision, state });
  };

  /** 前方真正在等人数（与 server aheadOf 语义一致） */
  const aheadOfLocal = (c: Candidate): number => {
    if (c.status !== 'waiting') return -1;
    const idx = waitingList(state, c.department).findIndex((x) => x.id === c.id);
    return idx === -1 ? -1 : idx;
  };

  return {
    kind: 'local',
    state,
    subscribe: (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    refresh: async () => {
      /* no-op，本地即时 */
    },
    register: async (input) => {
      const r = registerCandidate(state, input);
      if (r.created) {
        bump(r.state);
      } else {
        state = r.state;
        emit();
      }
      return { created: r.created, candidate: r.candidate, ahead: aheadOfLocal(r.candidate) };
    },
    lookup: async (mobile) =>
      state.candidates
        .filter((c) => c.mobile === mobile)
        .map((c) => ({ ...c, ahead: aheadOfLocal(c) })),
    login: async (pw) => {
      if (pw !== (localStorage.getItem(LS_LOCAL_PW) || '123')) throw Object.assign(new Error('密码错误'), { status: 401 });
      return 'local-token';
    },
    callNext: async (dept) => {
      bump(callNext(state, dept));
    },
    recall: async (dept) => {
      bump(recall(state, dept));
    },
    reorder: async (dept, candidateId, action) => {
      bump(reorder(state, dept, candidateId, action));
    },
    complete: async (candidateId) => {
      bump(completeInterview(state, candidateId));
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
