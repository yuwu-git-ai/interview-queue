import { describe, it, expect } from 'vitest';
import {
  createEmptyState, registerCandidate, callNext, recall, reorder, completeInterview,
  buildAnnouncementText, statsOf, waitingList, listByStatus, findCandidateByMobile,
} from '@/shared/engine';

const T0 = 1_700_000_000_000;

function seed(codes: Array<'A' | 'B' | 'C' | 'D'>) {
  let s = createEmptyState();
  codes.forEach((c, i) => {
    s = registerCandidate(s, {
      department: c, name: `考生${i}`, mobile: `1380000${String(i).padStart(4, '0')}`,
      wechat: `wx${i}`, gradeClass: '计科2201', note: '', now: T0 + i,
    }).state;
  });
  return s;
}

describe('createEmptyState', () => {
  it('初始 4 部门、零候选、revision 0', () => {
    const s = createEmptyState();
    expect(Object.keys(s.departments).length).toBe(4);
    expect(s.candidates.length).toBe(0);
    expect(s.revision).toBe(0);
    expect(s.counters.A).toBe(0);
  });
});

describe('registerCandidate', () => {
  it('生成部门专属序号 A01→A02', () => {
    const s1 = registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 }).state;
    const s2 = registerCandidate(s1, { department: 'A', name: '乙', mobile: '13800000002', wechat: 'w', gradeClass: 'c', note: '', now: T0 + 1 }).state;
    expect(s2.candidates.find(c => c.name === '甲')?.number).toBe('A01');
    expect(s2.candidates.find(c => c.name === '乙')?.number).toBe('A02');
    expect(s2.revision).toBe(2);
  });
  it('不同部门独立计数（B 从 B01 开始）', () => {
    const s = seed(['A', 'B']);
    expect(s.candidates.find(c => c.department === 'A')?.number).toBe('A01');
    expect(s.candidates.find(c => c.department === 'B')?.number).toBe('B01');
  });
  it('同手机号同部门未完成 → created:false 不重复发号', () => {
    const base = registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 }).state;
    const dup = registerCandidate(base, { department: 'A', name: '甲2', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 + 2 });
    expect(dup.created).toBe(false);
    expect(dup.existing?.name).toBe('甲');
    expect(dup.state.candidates.length).toBe(1);
    expect(dup.state.revision).toBe(base.revision);
  });
  it('同手机号已完成后再登记 → 允许新号', () => {
    let s = registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 }).state;
    s = callNext(s, 'A', T0 + 5);                                  // 甲 → interviewing
    s = completeInterview(s, s.candidates[0].id, T0 + 6);          // 甲 → completed
    const again = registerCandidate(s, { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 + 7 });
    expect(again.created).toBe(true);
    expect(again.candidate.number).toBe('A02');
  });
  it('手机号校验失败抛错', () => {
    expect(() => registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '123', wechat: 'w', gradeClass: 'c', note: '', now: T0 })).toThrow();
  });
});

describe('callNext 状态机', () => {
  it('空队列呼叫 → 不产生 interviewing、无公告、revision 不变', () => {
    const s = callNext(createEmptyState(), 'A', T0 + 10);
    expect(s.announcements.length).toBe(0);
    expect(s.revision).toBe(0);
  });
  it('呼叫 → 队首 waiting→interviewing', () => {
    const base = seed(['A', 'A', 'A']);
    const s = callNext(base, 'A', T0 + 10);
    const first = s.candidates.find(c => c.number === 'A01')!;
    expect(first.status).toBe('interviewing');
    expect(first.interviewStartedAt).toBe(T0 + 10);
    expect(s.announcements.length).toBe(1);
    expect(s.announcements[0].type).toBe('call');
    expect(s.stats.interviewing).toBe(1);
  });
  it('连续呼叫 → 原 interviewing 自动 completed，第二位进入 interviewing', () => {
    const base = seed(['A', 'A', 'A']);
    let s = callNext(base, 'A', T0 + 10);
    s = callNext(s, 'A', T0 + 20);
    const byNum = (n: string) => s.candidates.find(c => c.number === n)!;
    expect(byNum('A01').status).toBe('completed');
    expect(byNum('A02').status).toBe('interviewing');
    expect(byNum('A03').status).toBe('waiting');
    expect(s.announcements.length).toBe(2);
    expect(s.stats.completed).toBe(1);
  });
  it('排队队列顺序稳定', () => {
    const s = seed(['A', 'A', 'A']);
    expect(waitingList(s, 'A').map(c => c.number)).toEqual(['A01', 'A02', 'A03']);
  });
});

describe('recall / reorder / complete', () => {
  it('recall 不改状态，仅加 recall 公告', () => {
    let s = callNext(seed(['A']), 'A', T0 + 10);
    s = recall(s, 'A', T0 + 30);
    expect(s.announcements.length).toBe(2);
    expect(s.announcements[1].type).toBe('recall');
    expect(s.candidates.find(c => c.number === 'A01')?.status).toBe('interviewing');
  });
  it('reorder top：interviewing 不参与，队内重排', () => {
    const base = seed(['A', 'A', 'A']);
    let s = callNext(base, 'A', T0 + 10);
    s = reorder(s, 'A', s.candidates.find(c => c.number === 'A03')!.id, 'top', T0 + 11);
    expect(waitingList(s, 'A').map(c => c.number)).toEqual(['A03', 'A02']);
  });
  it('reorder up/down 边界不越界', () => {
    const s = seed(['A', 'A', 'A']);
    const [a1, a2, a3] = s.candidates;
    const afterUp = reorder(s, 'A', a3.id, 'up', T0);
    expect(waitingList(afterUp, 'A').map(c => c.number)).toEqual(['A01', 'A03', 'A02']);
    const afterDown = reorder(s, 'A', a1.id, 'down', T0);
    expect(waitingList(afterDown, 'A').map(c => c.number)).toEqual(['A02', 'A01', 'A03']);
  });
  it('completeInterview 结束当前面试者', () => {
    let s = callNext(seed(['A']), 'A', T0 + 10);
    const id = s.candidates.find(c => c.number === 'A01')!.id;
    s = completeInterview(s, id, T0 + 20);
    expect(s.candidates.find(c => c.id === id)?.status).toBe('completed');
    expect(s.stats.completed).toBe(1);
    expect(s.stats.interviewing).toBe(0);
  });
});

describe('派生视图', () => {
  it('listByStatus 分组', () => {
    let s = seed(['A', 'A', 'A']);
    s = callNext(s, 'A', T0 + 10);
    s = callNext(s, 'A', T0 + 20);
    expect(listByStatus(s, 'A').interviewing.length).toBe(1);
    expect(listByStatus(s, 'A').completed.length).toBe(1);
    expect(listByStatus(s, 'A').waiting.length).toBe(1);
  });
  it('findCandidateByMobile / statsOf / buildAnnouncementText', () => {
    const s = seed(['A']);
    const c = s.candidates[0];
    expect(findCandidateByMobile(s, '13800000000')?.id).toBe(c.id);
    expect(statsOf(s)).toEqual({ total: 1, interviewing: 0, waiting: 1, completed: 0 });
    expect(buildAnnouncementText(s, c.id)).toContain('A01');
    expect(buildAnnouncementText(s, c.id)).toContain('教210');
  });
});
