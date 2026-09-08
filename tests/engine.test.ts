import { describe, it, expect } from 'vitest';
import {
  createEmptyState, registerCandidate, addCandidate, callCandidates, recall, reorder, completeInterview, addComment, setJudgment, removeCandidate, advanceSession,
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

function byNum(s: ReturnType<typeof seed>, n: string) {
  return s.candidates.find((c) => c.number === n)!;
}

describe('createEmptyState', () => {
  it('初始 4 部门、零候选、场次 1、revision 0', () => {
    const s = createEmptyState();
    expect(Object.keys(s.departments).length).toBe(4);
    expect(s.candidates.length).toBe(0);
    expect(s.archive.length).toBe(0);
    expect(s.currentSession).toBe(1);
    expect(s.revision).toBe(0);
    expect(s.counters.A).toBe(0);
  });
});

describe('registerCandidate', () => {
  it('生成部门专属序号 A01→A02 并盖上场次/日期章', () => {
    const s1 = registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 }).state;
    const s2 = registerCandidate(s1, { department: 'A', name: '乙', mobile: '13800000002', wechat: 'w', gradeClass: 'c', note: '', now: T0 + 1 }).state;
    expect(s2.candidates.find((c) => c.name === '甲')?.number).toBe('A01');
    expect(s2.candidates.find((c) => c.name === '乙')?.number).toBe('A02');
    expect(s2.revision).toBe(2);
    expect(s2.candidates[0].session).toBe(1);
    expect(typeof s2.candidates[0].day).toBe('string');
  });
  it('不同部门独立计数（B 从 B01 开始）', () => {
    const s = seed(['A', 'B']);
    expect(s.candidates.find((c) => c.department === 'A')?.number).toBe('A01');
    expect(s.candidates.find((c) => c.department === 'B')?.number).toBe('B01');
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
    const id = byNum(s, 'A01').id;
    s = callCandidates(s, 'A', [id], T0 + 5); // 甲 → interviewing
    s = completeInterview(s, id, T0 + 6); // 甲 → completed
    const again = registerCandidate(s, { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 + 7 });
    expect(again.created).toBe(true);
    expect(again.candidate.number).toBe('A02');
  });
  it('手机号校验失败抛错', () => {
    expect(() => registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '123', wechat: 'w', gradeClass: 'c', note: '', now: T0 })).toThrow();
  });
});

describe('addCandidate 面试官补录', () => {
  it('仅姓名+手机号即可入队，微信/班级默认空串', () => {
    const r = addCandidate(createEmptyState(), { department: 'A', name: '现场生', mobile: '13800006666', now: T0 });
    expect(r.candidate.number).toBe('A01');
    expect(r.candidate.wechat).toBe('');
    expect(r.candidate.gradeClass).toBe('');
    expect(r.candidate.status).toBe('waiting');
    expect(waitingList(r.state, 'A').map((c) => c.number)).toEqual(['A01']);
  });
  it('同部门同手机号未完成 → 抛错提示已有登记', () => {
    const s = addCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800006666', now: T0 }).state;
    expect(() => addCandidate(s, { department: 'A', name: '乙', mobile: '13800006666', now: T0 + 1 })).toThrow(/已有登记/);
  });
  it('已完成后再补录同手机号 → 允许（新号 A02）', () => {
    let s = addCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800006666', now: T0 }).state;
    const id = byNum(s, 'A01').id;
    s = callCandidates(s, 'A', [id], T0 + 5);
    s = completeInterview(s, id, T0 + 6);
    const again = addCandidate(s, { department: 'A', name: '甲', mobile: '13800006666', now: T0 + 7 });
    expect(again.candidate.number).toBe('A02');
  });
  it('空姓名 / 非法手机号 → 抛错', () => {
    expect(() => addCandidate(createEmptyState(), { department: 'A', name: '', mobile: '13800006666' })).toThrow();
    expect(() => addCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '123' })).toThrow();
  });
});

describe('callCandidates 选人/分组叫号', () => {
  it('未勾选任何面试者 → 抛错', () => {
    expect(() => callCandidates(createEmptyState(), 'A', [], T0 + 10)).toThrow(/勾选/);
  });
  it('单人选叫 → 进面试中 + 一条 call 公告', () => {
    const base = seed(['A', 'A', 'A']);
    const a1 = byNum(base, 'A01');
    const s = callCandidates(base, 'A', [a1.id], T0 + 10);
    expect(byNum(s, 'A01').status).toBe('interviewing');
    expect(byNum(s, 'A01').interviewStartedAt).toBe(T0 + 10);
    expect(s.announcements.length).toBe(1);
    expect(s.announcements[0].type).toBe('call');
    expect(s.stats.interviewing).toBe(1);
  });
  it('整组多人同时叫 → 全体 interviewing，仅一条组公告（含多位姓名）', () => {
    const base = seed(['A', 'A', 'A']);
    const s = callCandidates(base, 'A', base.candidates.map((c) => c.id), T0 + 10);
    expect(s.candidates.every((c) => c.status === 'interviewing')).toBe(true);
    expect(s.announcements.length).toBe(1);
    expect(s.announcements[0].text).toContain('A01');
    expect(s.announcements[0].text).toContain('A03');
    expect(s.stats.interviewing).toBe(3);
  });
  it('已不在等待中（重复/已完成）的面试者不可再被叫', () => {
    const base = seed(['A', 'A', 'A']);
    const a1 = byNum(base, 'A01');
    const s = callCandidates(base, 'A', [a1.id], T0 + 10);
    expect(() => callCandidates(s, 'A', [a1.id], T0 + 11)).toThrow();
  });
  it('部门已有未完成面试者时，再叫下一组 → 拒绝（须先完成）', () => {
    const base = seed(['A', 'A', 'A']);
    const a1 = byNum(base, 'A01');
    const a2 = byNum(base, 'A02');
    const s = callCandidates(base, 'A', [a1.id], T0 + 10);
    expect(() => callCandidates(s, 'A', [a2.id], T0 + 20)).toThrow(/完成/);
    const s2 = completeInterview(s, a1.id, T0 + 30);
    const s3 = callCandidates(s2, 'A', [a2.id], T0 + 40);
    expect(byNum(s3, 'A02').status).toBe('interviewing');
  });
  it('两个部门各自叫号互不冲突，各自保留面试中与公告', () => {
    const base = seed(['A', 'B']);
    const a = byNum(base, 'A01');
    const b = byNum(base, 'B01');
    const s1 = callCandidates(base, 'A', [a.id], T0 + 10);
    const s2 = callCandidates(s1, 'B', [b.id], T0 + 11);
    expect(s2.candidates.filter((c) => c.status === 'interviewing').length).toBe(2);
    expect(s2.announcements.length).toBe(2);
    expect(s2.announcements[0].department).toBe('A');
    expect(s2.announcements[1].department).toBe('B');
  });
  it('排队队列顺序稳定', () => {
    const s = seed(['A', 'A', 'A']);
    expect(waitingList(s, 'A').map((c) => c.number)).toEqual(['A01', 'A02', 'A03']);
  });
});

describe('recall / reorder / completeInterview', () => {
  it('recall 不改变状态，仅对当前整组加一条 recall 公告', () => {
    const base = seed(['A', 'A']);
    const a1 = byNum(base, 'A01');
    const s1 = callCandidates(base, 'A', [a1.id], T0 + 10);
    const s2 = recall(s1, 'A', T0 + 30);
    expect(s2.announcements.length).toBe(s1.announcements.length + 1);
    expect(s2.announcements[s2.announcements.length - 1].type).toBe('recall');
    expect(byNum(s2, 'A01').status).toBe('interviewing');
  });
  it('reorder top：interviewing 不参与，队内重排', () => {
    const base = seed(['A', 'A', 'A']);
    const s1 = callCandidates(base, 'A', [byNum(base, 'A01').id], T0 + 10);
    const s2 = reorder(s1, 'A', byNum(s1, 'A03').id, 'top', T0 + 11);
    expect(waitingList(s2, 'A').map((c) => c.number)).toEqual(['A03', 'A02']);
  });
  it('reorder up/down 边界不越界', () => {
    const s = seed(['A', 'A', 'A']);
    const [a1, , a3] = s.candidates;
    expect(waitingList(reorder(s, 'A', a3.id, 'up', T0), 'A').map((c) => c.number)).toEqual(['A01', 'A03', 'A02']);
    expect(waitingList(reorder(s, 'A', a1.id, 'down', T0), 'A').map((c) => c.number)).toEqual(['A02', 'A01', 'A03']);
  });
  it('completeInterview 结束某位面试者', () => {
    const base = seed(['A']);
    const a1 = byNum(base, 'A01');
    const s1 = callCandidates(base, 'A', [a1.id], T0 + 10);
    const s2 = completeInterview(s1, a1.id, T0 + 20);
    expect(byNum(s2, 'A01').status).toBe('completed');
    expect(s2.stats.completed).toBe(1);
    expect(s2.stats.interviewing).toBe(0);
  });
});

describe('派生视图', () => {
  it('listByStatus 分组（含完成一位后再叫下一位）', () => {
    const base = seed(['A', 'A', 'A']);
    const a1 = byNum(base, 'A01');
    const a2 = byNum(base, 'A02');
    let s = callCandidates(base, 'A', [a1.id], T0 + 10);
    s = completeInterview(s, a1.id, T0 + 20);
    s = callCandidates(s, 'A', [a2.id], T0 + 30);
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

describe('addComment / setJudgment 面试备注与临时判断', () => {
  it('追加备注不覆盖：两次各成一条，顺序保留', () => {
    const base = seed(['A']);
    const id = base.candidates[0].id;
    const s1 = addComment(base, id, '沟通流畅', T0 + 1);
    const s2 = addComment(s1, id, '临场表现佳', T0 + 2);
    expect(s2.candidates[0].comments.map((c) => c.text)).toEqual(['沟通流畅', '临场表现佳']);
    expect(s2.candidates[0].comments[1].at).toBe(T0 + 2);
  });
  it('空备注 / 不存在候选人 → 抛错', () => {
    const base = seed(['A']);
    expect(() => addComment(base, base.candidates[0].id, '   ', T0)).toThrow();
    expect(() => addComment(base, 'nope', 'x', T0)).toThrow();
  });
  it('临时判断：设置→覆盖→清除', () => {
    const base = seed(['A']);
    const id = base.candidates[0].id;
    const s1 = setJudgment(base, id, 'pass', T0);
    expect(s1.candidates[0].judgment).toBe('pass');
    const s2 = setJudgment(s1, id, 'discuss', T0 + 1);
    expect(s2.candidates[0].judgment).toBe('discuss');
    const s3 = setJudgment(s2, id, null, T0 + 2);
    expect('judgment' in s3.candidates[0]).toBe(false);
  });
  it('已归档（不在当前在册）不可再备注/判断', () => {
    const s = advanceSession(seed(['A']), T0);
    const archivedId = s.archive[0].id;
    expect(() => addComment(s, archivedId, 'x', T0)).toThrow();
    expect(() => setJudgment(s, archivedId, 'pass', T0)).toThrow();
  });
});

describe('removeCandidate 删除记录', () => {
  it('删除当前队列等待者：移出列表并同步清出队列', () => {
    const base = seed(['A', 'A', 'A']);
    const a2 = byNum(base, 'A02');
    const s = removeCandidate(base, a2.id);
    expect(s.candidates.length).toBe(2);
    expect(waitingList(s, 'A').map((c) => c.number)).toEqual(['A01', 'A03']);
  });
  it('删除面试中者同样移除并重算统计', () => {
    const base = seed(['A', 'A']);
    const a1 = byNum(base, 'A01');
    const s1 = callCandidates(base, 'A', [a1.id], T0);
    const s2 = removeCandidate(s1, a1.id);
    expect(s2.candidates.length).toBe(1);
    expect(s2.stats.interviewing).toBe(0);
  });
  it('删除历史归档记录', () => {
    const s1 = advanceSession(seed(['A']), T0);
    const id = s1.archive[0].id;
    const s2 = removeCandidate(s1, id);
    expect(s2.archive.length).toBe(0);
    expect(s2.candidates.length).toBe(0);
  });
  it('删除不存在的 id → revision 不变', () => {
    const base = seed(['A']);
    expect(removeCandidate(base, 'nope').revision).toBe(base.revision);
  });
});

describe('advanceSession 多天场次', () => {
  it('开启新一天：全部归档、未完成记已过号、看板清空、号码重排', () => {
    let s = seed(['A', 'A', 'A']);
    const a1 = byNum(s, 'A01');
    s = callCandidates(s, 'A', [a1.id], T0 + 10); // A01 → interviewing
    s = completeInterview(s, a1.id, T0 + 12); // A01 → completed
    expect(s.candidates.length).toBe(3);
    const s1 = advanceSession(s, T0 + 20);
    expect(s1.candidates.length).toBe(0);
    expect(s1.archive.length).toBe(3);
    expect(s1.currentSession).toBe(2);
    expect(s1.counters.A).toBe(0);
    expect(s1.archive.find((c) => c.number === 'A01')?.status).toBe('completed');
    expect(s1.archive.find((c) => c.number === 'A02')?.status).toBe('no_show');
    expect(s1.archive.find((c) => c.number === 'A03')?.status).toBe('no_show');
    // 第二天从 A01 重新排、归属第 2 场
    const s2 = registerCandidate(s1, { department: 'A', name: '新人', mobile: '13800001234', wechat: 'w', gradeClass: 'c', note: '', now: T0 + 30 }).state;
    expect(byNum(s2, 'A01').name).toBe('新人');
    expect(byNum(s2, 'A01').session).toBe(2);
    expect(s2.archive.length).toBe(3);
  });
  it('登记自动盖场次/日期章，归档记录保留原场次', () => {
    let s = registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 }).state;
    expect(s.candidates[0].session).toBe(1);
    expect(typeof s.candidates[0].day).toBe('string');
    s = advanceSession(s, T0 + 1);
    expect(s.archive[0].session).toBe(1);
    expect(s.currentSession).toBe(2);
  });
});
