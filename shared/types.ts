export type DeptCode = 'A' | 'B' | 'C' | 'D';
export type Status = 'waiting' | 'interviewing' | 'completed' | 'no_show';
export type AnnounceType = 'call' | 'recall';

export interface Department {
  code: DeptCode;
  name: string;   // 事业部/综务部/信技部/宣传部
  room: string;   // 教210/教211
}

export interface Candidate {
  id: string;            // uuid
  department: DeptCode;
  number: string;        // A01, B02…
  seq: number;           // 部门内序号
  name: string;
  mobile: string;        // 11 位
  wechat: string;
  gradeClass: string;    // 年级与专业班级
  note: string;          // 经历/特长
  status: Status;
  callCount: number;
  registeredAt: number;  // epoch ms
  interviewStartedAt?: number;
  interviewEndedAt?: number;
  result?: 'hired' | 'rejected' | 'pending';
}

export interface Announcement {
  id: number;
  type: AnnounceType;
  department: DeptCode;
  candidateId: string;
  text: string;   // "A02号 钱心雨 同学 请前往 事业部(教210) 参加面试"
  at: number;
}

export interface AppState {
  revision: number;
  departments: Record<DeptCode, Department>;
  candidates: Candidate[];
  queueOrder: Record<DeptCode, string[]>;   // 各部门 waiting 的候选 id 有序数组
  announcements: Announcement[];
  counters: Record<DeptCode, number>;
  stats: { total: number; interviewing: number; waiting: number; completed: number };
}
