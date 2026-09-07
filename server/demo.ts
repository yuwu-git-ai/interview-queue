import type { AppState } from '../shared/types';
import { createEmptyState, registerCandidate, callNext } from '../shared/engine';

/** 生成一套可视化的演示状态：4 部门各若干等待 + 每部门 1 面试中 + 若干已完成 */
export function demoState(now = Date.now()): AppState {
  let s = createEmptyState();
  const names: Record<string, string[]> = {
    A: ['钱心雨', '李文博', '赵一凡', '孙静', '周子墨'],
    B: ['吴思远', '郑晓雪', '王浩宇', '陈佳琳'],
    C: ['刘子轩', '杨雨欣', '黄明哲', '张诗涵', '林俊凯', '罗雨桐'],
    D: ['徐艺洋', '高远航', '宋佳音', '唐启明'],
  };
  let i = 0;
  (Object.keys(names) as Array<'A' | 'B' | 'C' | 'D'>).forEach((dept) => {
    names[dept].forEach((name, j) => {
      const mobile = '138' + String(10000000 + i * 137).slice(0, 8);
      const r = registerCandidate(s, {
        department: dept, name, mobile,
        wechat: `wx_${dept}_${j + 1}`, gradeClass: j % 2 ? '计科2401' : '机械2302',
        note: j % 3 === 0 ? '有学生会干部经历' : '',
        now: now - (20 - j) * 60000,
      });
      s = r.state;
      i += 1;
    });
  });
  // 每部门呼叫 2 位让看板有"面试中 + 已完成"
  (['A', 'B', 'C', 'D'] as const).forEach((dept) => {
    s = callNext(s, dept, now - 3 * 60000);
    s = callNext(s, dept, now - 1 * 60000);
  });
  return s;
}
