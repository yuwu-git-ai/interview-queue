import type { DeptCode, Department } from './types';

export const DEPARTMENTS: Department[] = [
  { code: 'A', name: '事业部', room: '教210' },
  { code: 'B', name: '综务部', room: '教210' },
  { code: 'C', name: '信技部', room: '教211' },
  { code: 'D', name: '宣传部', room: '教211' },
];

export const DEPT_MAP: Record<DeptCode, Department> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.code, d])
) as Record<DeptCode, Department>;

export const WAIT_ROOM = '教208';
export const MOBILE_RE = /^1[3-9]\d{9}$/;
export const NUMBER_PAD = 2;               // A01（从 1 开始，补零到至少 2 位）
export const MAX_ANNOUNCEMENTS = 30;

export const DEPT_COLOR: Record<DeptCode, { bg: string; text: string; border: string; soft: string }> = {
  A: { bg: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-600', soft: 'bg-blue-50' },
  B: { bg: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-600', soft: 'bg-emerald-50' },
  C: { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-500', soft: 'bg-orange-50' },
  D: { bg: 'bg-violet-600', text: 'text-violet-700', border: 'border-violet-600', soft: 'bg-violet-50' },
};
