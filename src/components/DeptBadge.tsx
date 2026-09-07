import { DEPT_MAP, DEPT_COLOR } from '@/shared/constants';
import type { DeptCode } from '@/shared/types';

export default function DeptBadge({ code, size = 'md' }: { code: DeptCode; size?: 'sm' | 'md' | 'lg' }) {
  const d = DEPT_MAP[code];
  const c = DEPT_COLOR[code];
  const pad = size === 'lg' ? 'px-4 py-1.5 text-lg' : size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg font-bold text-white ${c.bg} ${pad}`}>
      <span>{code}</span>
      <span>{d.name}</span>
    </span>
  );
}
