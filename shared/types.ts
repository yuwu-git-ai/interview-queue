export type DeptCode = 'A' | 'B' | 'C' | 'D';
export type Status = 'waiting' | 'interviewing' | 'completed' | 'no_show';
export type AnnounceType = 'call' | 'recall';

/** 面试官对候选人的临时判断：通过 / 不通过 / 待商讨 */
export type Judgment = 'pass' | 'fail' | 'discuss';

/** 一条面试备注（多面试官追加式，各自独立不覆盖，类似评论区） */
export interface Comment {
  id: number;
  text: string;
  at: number; // epoch ms
}

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
  session: number;       // 第几场(天)，从 1 起，号码每天从 A01 重排
  day: string;           // 登记当天日期 YYYY-MM-DD（用于历史区分/筛选/导出）
  name: string;
  mobile: string;        // 11 位
  wechat: string;
  gradeClass: string;    // 年级与专业班级
  note: string;          // 经历/特长
  comments: Comment[];   // 面试备注（追加式，多面试官可同时写）
  judgment?: Judgment;   // 临时判断（选填）：pass 通过 / fail 不通过 / discuss 待商讨
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
  currentSession: number;   // 当前第几场(天)；board/看板/叫号只显示本场
  candidates: Candidate[];  // 本场在册
  archive: Candidate[];     // 历史场次归档（跨天保留，可按场次筛选/导出）
  queueOrder: Record<DeptCode, string[]>;   // 各部门 waiting 的候选 id 有序数组
  announcements: Announcement[];
  counters: Record<DeptCode, number>;
  stats: { total: number; interviewing: number; waiting: number; completed: number };
}
