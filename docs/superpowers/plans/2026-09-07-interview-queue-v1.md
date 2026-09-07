# 面试排队叫号系统 v1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `E:\面试排队叫号系统\` 交付一个本地可运行的面试排队叫号系统 v1——等候室大屏(常驻二维码 + 4 部门看板 + 叫号语音)、手机登记出号、面试官密码控制台，支持多屏一致与后端不可达时的 localStorage 降级。

**Architecture:** React 19 + TS + Tailwind v4 前端(经 `?view=` 切换 screen/register/interviewer)，Express 轻后端单进程持有内存态并原子落盘 JSON，前端 2s 轮询 `/api/state` 对比 `revision` 刷新。状态机为纯函数引擎，前后端复用，配 vitest 单测 + supertest 集成测。语音只在等候室大屏上、仅在面试官点击后通过新公告触发。

**Tech Stack:** React 19 · Vite 6 · Tailwind CSS v4 · TypeScript ~5.8 · Express 4 · vitest 4 · qrcode + @types/qrcode · lucide-react · tsx。Node v25.6.0 / npm 11.8.0（本机已装）。沿用窝里蹲已验证脚本范式与依赖版本。

**参考设计文档:** `docs/superpowers/specs/2026-09-07-interview-queue-design.md`
**参考仓库:** [glitter1105/queue](https://github.com/glitter1105/queue)（状态机/防重复/双通道脱敏思路）、[窝里蹲点单系统](https://github.com/yuwu-git-ai/wolidun)（本地脚本/结构范式）

---

## 文件结构总览

```
E:\面试排队叫号系统\
├─ package.json / tsconfig.json / tsconfig.node.json
├─ vite.config.ts / index.html / vitest.config.ts
├─ .env.example / .gitignore(已有) / README.md
├─ shared/                 # 前后端复用的纯逻辑（无 DOM / 无 import.meta）
│  ├─ types.ts             # 领域类型 + 状态机
│  ├─ constants.ts         # 部门常量、教室、正则、演示候选人
│  └─ engine.ts            # 纯状态机：createCandidate/register/callNext/recall/reorder/complete/state 推导
├─ server/
│  ├─ store.ts             # ServerState 单例：内存态 + JSON 原子落盘 + 加解密密码
│  └─ index.ts             # Express：/api/health、/api/state、REST 端点、静态托管 dist/
├─ tests/
│  ├─ engine.test.ts       # vitest 纯逻辑单测
│  └─ api.test.ts          # supertest 集成测
├─ src/
│  ├─ main.tsx / App.tsx   # ?view= 分发 + 全局 Shell
│  ├─ index.css            # Tailwind v4 + 全局样式
│  ├─ lib/
│  │  ├─ qrcode.ts         # qrcode → DataURL
│  │  ├─ tts.ts            # speechSynthesis 单例（中文优选/队列/去重/静音）
│  │  └─ store.ts          # 前端 Store：ServerStore(轮询) / LocalStore(localStorage+BroadcastChannel)
│  ├─ components/          # 跨视图复用（QR 卡、部门色板、凭条、按钮…）
│  └─ views/
│     ├─ screen/           # 等候室大屏
│     ├─ register/         # 手机登记 + 进度查询
│     └─ interviewer/      # 面试官控制台（登录/调度）
└─ data/state.json         # 运行时生成（.gitignore 已含 data/）
```

依赖安装清单（v1 用版本与窝里蹲一致，避免升级坑）：

```bash
npm i react react-dom lucide-react qrcode express
npm i -D vite @vitejs/plugin-react @tailwindcss/vite tailwindcss typescript tsx vitest supertest @types/react @types/react-dom @types/express @types/qrcode @types/supertest @types/node
```

> 说明：窝里蹲用 better-sqlite3，本系统按设计文档改用 **JSON 文件持久化**，无需原生编译，Windows/Docker 均顺畅，契合"无重度后端"。

---

### Task 1: 工程脚手架（package.json / tsconfig / vite / index.html / tailwind）

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/index.css`
- Create: `src/main.tsx`
- Create: `src/App.tsx`（占位，Task 8 填实）
- Create: `.env.example`
- Create: `vitest.config.ts`

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "interview-queue",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "dev:server": "tsx watch server/index.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:server\"",
    "build": "vite build",
    "preview": "vite preview",
    "start": "tsx server/index.ts",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "concurrently": "^9.2.1",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "lucide-react": "^0.546.0",
    "qrcode": "^1.5.4",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "tsx": "^4.21.0",
    "vite": "^6.2.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^19.2.15",
    "@types/react-dom": "^19.2.3",
    "@types/supertest": "^7.2.0",
    "@types/uuid": "^10.0.0",
    "autoprefixer": "^10.4.21",
    "eslint": "^10.4.1",
    "superagent": "^10.2.0",
    "supertest": "^7.2.2",
    "tailwindcss": "^4.1.14",
    "typescript": "~5.8.2",
    "uuid": "^14.0.0",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**（含 paths：`@/*` → `./*`，覆盖 shared/server/src/tests）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["src", "server", "shared", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: 写 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: 写 vite.config.ts**（dev 代理 /api → 3001；@ 别名）

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
});
```

- [ ] **Step 5: 写 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>面试排队叫号系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: 写 src/index.css**

```css
@import "tailwindcss";

html, body, #root { height: 100%; }
body { @apply bg-slate-100 text-slate-900 antialiased; }
.scrollbar-none { scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
```

- [ ] **Step 7: 写 src/main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 8: 写 src/App.tsx（占位，Task 8 替换）**

```tsx
export default function App() {
  return <div className="grid h-full place-items-center text-lg">面试排队叫号系统 · 脚手架</div>;
}
```

- [ ] **Step 9: 写 .env.example**

```
# 面试官登录密码（UI 任何位置绝不显示）。本地默认 123。
INTERVIEWER_PASSWORD=123
# 服务端口
PORT=3001
# 状态文件路径
STATE_FILE=./data/state.json
# 生产前端静态目录
STATIC_DIR=./dist
```

- [ ] **Step 10: 写 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 11: 安装依赖**

Run: `cd /e/面试排队叫号系统 && npm install`
Expected: exit 0，`node_modules/` 生成。

- [ ] **Step 12: 快速验证编译通过**

Run: `cd /e/面试排队叫号系统 && npx tsc --noEmit`
Expected: exit 0，无类型错误（App 占位）。

- [ ] **Step 13: Commit**

```bash
git add -A && git commit -m "chore: 工程脚手架 (vite+react+ts+tailwind)"
```

---

### Task 2: 领域类型与常量

**Files:**
- Create: `shared/types.ts`
- Create: `shared/constants.ts`

- [ ] **Step 1: 写 shared/types.ts**

```ts
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
  seq: number;           // 部门内序号（不依赖字符串解析）
  name: string;
  mobile: string;        // 11 位
  wechat: string;
  gradeClass: string;    // 年级与专业班级
  note: string;          // 经历/特长（可空）
  status: Status;
  callCount: number;
  registeredAt: number;  // epoch ms
  interviewStartedAt?: number;  // 进入 interviewing 的时刻 → 大屏计时
  interviewEndedAt?: number;
  result?: 'hired' | 'rejected' | 'pending';  // v1 界面简化，字段预留
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
  queueOrder: Record<DeptCode, string[]>;   // 各部门 waiting 的候选 id 有序数组（置顶/上移/下移 = 数组换位）
  announcements: Announcement[];            // 最近 N 条，驱动大屏语音与播报
  counters: Record<DeptCode, number>;       // 各部门取号计数器
  stats: { total: number; interviewing: number; waiting: number; completed: number; };
}
```

- [ ] **Step 2: 写 shared/constants.ts**

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(shared): 领域类型与部门常量"
```

---

### Task 3: 纯状态机引擎 + 单测（核心，TDD）

**Files:**
- Create: `shared/engine.ts`
- Test: `tests/engine.test.ts`

引擎函数全部纯函数、以 `AppState` 进出，`now` 默认参数便于测试。`revision` 在每次结构性变更处 +1。

- [ ] **Step 1: 先写失败测试 tests/engine.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import {
  createEmptyState, registerCandidate, callNext, recall, reorder, completeInterview,
  buildAnnouncementText, statsOf, waitingList, listByStatus, findCandidateByMobile,
} from '@/shared/engine';

const T0 = 1_700_000_000_000;

function seed(codes: Array<'A'|'B'|'C'|'D'>) {
  const s = createEmptyState();
  codes.forEach((c, i) => {
    s = registerCandidate(s, {
      department: c, name: `考生${i}`, mobile: `1380000${String(i).padStart(4,'0')}`,
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
  it('生成部门专属序号 A01→A02，全部门共用 1 个 revision 计数', () => {
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
  it('同手机号同部门未完成 → 拒绝并返回已有记录（不重复发号）', () => {
    const base = registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 }).state;
    const dup = registerCandidate(base, { department: 'A', name: '甲2', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 + 2 });
    expect(dup.created).toBe(false);
    expect(dup.existing?.name).toBe('甲');
    expect(base.candidates.length).toBe(1);
  });
  it('同手机号已完成后再登记 → 允许新号', () => {
    let s = registerCandidate(createEmptyState(), { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 }).state;
    s = completeInterview(s, s.candidates[0].id, T0 + 5);
    const again = registerCandidate(s, { department: 'A', name: '甲', mobile: '13800000001', wechat: 'w', gradeClass: 'c', note: '', now: T0 + 6 });
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
  it('呼叫 → 队首 waiting→interviewing，无原面试中者时不产生 completed', () => {
    const base = seed(['A', 'A', 'A']); // 3 人 A 部门
    const s = callNext(base, 'A', T0 + 10);
    const first = s.candidates.find(c => c.number === 'A01')!;
    expect(first.status).toBe('interviewing');
    expect(first.interviewStartedAt).toBe(T0 + 10);
    expect(s.announcements.length).toBe(1);
    expect(s.announcements[0].type).toBe('call');
    expect(s.stats.interviewing).toBe(1);
  });
  it('连续呼叫 → 原 interviewing 自动 completed，第二位进入 interviewing，产生两条公告', () => {
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
  it('排队队列顺序稳定：注册顺序 = waitingList 顺序', () => {
    const s = seed(['A', 'A', 'A']);
    expect(waitingList(s, 'A').map(c => c.number)).toEqual(['A01', 'A02', 'A03']);
  });
});

describe('recall / reorder / complete', () => {
  it('recall 不改状态，仅加一条 recall 公告', () => {
    let s = callNext(seed(['A']), 'A', T0 + 10);
    const before = s.revision;
    s = recall(s, 'A', T0 + 30);
    expect(s.announcements.length).toBe(2);
    expect(s.announcements[1].type).toBe('recall');
    expect(s.revision).toBeGreaterThan(before);
    expect(s.candidates.find(c => c.number === 'A01')?.status).toBe('interviewing');
  });
  it('waiting 中存在 interviewing 时不参与 reorder', () => {
    const base = seed(['A', 'A', 'A']);
    let s = callNext(base, 'A', T0 + 10);
    s = reorder(s, 'A', s.candidates.find(c => c.number === 'A03')!.id, 'top', T0 + 11);
    // A02 waiting、A03 waiting；置顶 A03 → 顺序 A03, A02
    expect(waitingList(s, 'A').map(c => c.number)).toEqual(['A03', 'A02']);
  });
  it('reorder up/down 边界不越界', () => {
    const s = seed(['A', 'A', 'A']);
    const [a1, a2, a3] = s.candidates;
    const afterUp = reorder(s, 'A', a3.id, 'up', T0);
    expect(waitingList(afterUp, 'A').map(c => c.number)).toEqual(['A01', 'A03', 'A02']);
    const afterDownLast = reorder(afterUp, 'A', a1.id, 'down', T0);
    expect(waitingList(afterDownLast, 'A').map(c => c.number)).toEqual(['A03', 'A02', 'A01']);
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
  it('listByStatus 分组统计', () => {
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
```

- [ ] **Step 2: 运行测试，确认全部失败（尚未实现）**

Run: `cd /e/面试排队叫号系统 && npx vitest run tests/engine.test.ts`
Expected: FAIL，报 "Cannot find module '@/shared/engine'"。

- [ ] **Step 3: 实现 shared/engine.ts**

```ts
import type { AppState, Candidate, DeptCode, Department, Status, Announcement } from './types';
import { DEPT_MAP, DEPARTMENTS, MOBILE_RE, NUMBER_PAD, MAX_ANNOUNCEMENTS } from './constants';

/** 浏览器与 Node 双兼容的 uuid（不用 node:crypto，避免打浏览器包报错） */
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface RegisterInput {
  department: DeptCode; name: string; mobile: string; wechat: string;
  gradeClass: string; note?: string; now?: number;
}

export function createEmptyState(): AppState {
  const departments = Object.fromEntries(DEPARTMENTS.map((d) => [d.code, { ...d }])) as Record<DeptCode, Department>;
  return {
    revision: 0,
    departments,
    candidates: [],
    queueOrder: { A: [], B: [], C: [], D: [] },
    announcements: [],
    counters: { A: 0, B: 0, C: 0, D: 0 },
    stats: { total: 0, interviewing: 0, waiting: 0, completed: 0 },
  };
}

function pad(seq: number): string {
  return String(seq).padStart(NUMBER_PAD, '0');
}

function withStats(s: AppState): AppState {
  s.stats = { total: 0, interviewing: 0, waiting: 0, completed: 0 };
  for (const c of s.candidates) {
    s.stats.total += 1;
    if (c.status === 'interviewing') s.stats.interviewing += 1;
    else if (c.status === 'waiting') s.stats.waiting += 1;
    else if (c.status === 'completed') s.stats.completed += 1;
  }
  return s;
}

/** 纯深拷贝，避免污染传入的 state */
function clone(s: AppState): AppState {
  const next: AppState = JSON.parse(JSON.stringify(s));
  next.revision += 1;
  return next;
}

function pushAnnouncement(s: AppState, type: Announcement['type'], candidateId: string, now: number) {
  s.announcements.push({
    id: (s.announcements.length ? s.announcements[s.announcements.length - 1].id + 1 : 1),
    type, department: s.candidates.find((c) => c.id === candidateId)!.department,
    candidateId, text: buildAnnouncementText(s, candidateId), at: now,
  });
  if (s.announcements.length > MAX_ANNOUNCEMENTS) s.announcements = s.announcements.slice(-MAX_ANNOUNCEMENTS);
}

export function registerCandidate(s: AppState, input: RegisterInput): { state: AppState; created: boolean; candidate: Candidate; existing?: Candidate } {
  const { department, name, mobile, wechat, gradeClass, note = '', now = Date.now() } = input;
  if (!DEPT_MAP[department]) throw new Error('部门不存在');
  if (!name?.trim()) throw new Error('请输入姓名');
  if (!MOBILE_RE.test(mobile)) throw new Error('请输入正确的 11 位手机号');
  if (!wechat?.trim()) throw new Error('请输入微信号');
  if (!gradeClass?.trim()) throw new Error('请输入年级与专业班级');

  const unfinished = s.candidates.find(
    (c) => c.department === department && c.mobile === mobile &&
      (c.status === 'waiting' || c.status === 'interviewing')
  );
  if (unfinished) {
    // 重复取号：不产生任何变更（revision 不变），返回已有记录
    return { state: s, created: false, candidate: unfinished, existing: unfinished };
  }

  const next = clone(s);
  const seq = next.counters[department] + 1;
  next.counters[department] = seq;
  const id = uuid();
  const candidate: Candidate = {
    id, department, number: `${department}${pad(seq)}`, seq,
    name: name.trim(), mobile, wechat, gradeClass: gradeClass.trim(),
    note: note.trim(), status: 'waiting', callCount: 0,
    registeredAt: now,
  };
  next.candidates.push(candidate);
  next.queueOrder[department].push(id);
  return { state: withStats(next), created: true, candidate };
}

export function callNext(s: AppState, department: DeptCode, now: number = Date.now()): AppState {
  const next = clone(s);
  const order = next.queueOrder[department];
  const current = next.candidates.find((c) => c.department === department && c.status === 'interviewing');
  const nextWaitingId = order.find((id) => next.candidates.find((c) => c.id === id)?.status === 'waiting');
  if (!nextWaitingId) return s; // 无人在等 → 不动作、revision 不变

  if (current) {
    current.status = 'completed';
    current.interviewEndedAt = now;
  }
  const chosen = next.candidates.find((c) => c.id === nextWaitingId)!;
  chosen.status = 'interviewing';
  chosen.interviewStartedAt = now;
  chosen.callCount += 1;
  pushAnnouncement(next, 'call', chosen.id, now);
  return withStats(next);
}

export function recall(s: AppState, department: DeptCode, now: number = Date.now()): AppState {
  const current = s.candidates.find((c) => c.department === department && c.status === 'interviewing');
  if (!current) return s;
  const next = clone(s);
  pushAnnouncement(next, 'recall', current.id, now);
  return next;
}

export type ReorderAction = 'top' | 'up' | 'down';

export function reorder(s: AppState, department: DeptCode, candidateId: string, action: ReorderAction, _now: number = Date.now()): AppState {
  const next = clone(s);
  const order = next.queueOrder[department];
  const idx = order.indexOf(candidateId);
  if (idx < 0) return s;
  const target = next.candidates.find((c) => c.id === candidateId);
  if (!target || target.status !== 'waiting') return s;
  const [item] = order.splice(idx, 1);
  let dest = idx;
  if (action === 'top') dest = 0;
  else if (action === 'up') dest = Math.max(0, idx - 1);
  else if (action === 'down') dest = Math.min(order.length, idx + 1);
  order.splice(dest, 0, item);
  return next;
}

export function completeInterview(s: AppState, candidateId: string, now: number = Date.now()): AppState {
  const next = clone(s);
  const c = next.candidates.find((x) => x.id === candidateId);
  if (!c || c.status !== 'interviewing') return s;
  c.status = 'completed';
  c.interviewEndedAt = now;
  c.result = 'pending';
  return withStats(next);
}

export function buildAnnouncementText(s: AppState, candidateId: string): string {
  const c = s.candidates.find((x) => x.id === candidateId)!;
  const d = DEPT_MAP[c.department];
  return `${c.number}号 ${c.name} 同学，请前往 ${d.name}（${d.room}） 参加面试`;
}

export function waitingList(s: AppState, department: DeptCode): Candidate[] {
  const set = new Map(s.candidates.map((c) => [c.id, c]));
  return (s.queueOrder[department] || [])
    .map((id) => set.get(id))
    .filter((c): c is Candidate => !!c && c.status === 'waiting');
}

export function listByStatus(s: AppState, department: DeptCode): Record<Status, Candidate[]> {
  const all = s.candidates.filter((c) => c.department === department);
  const waiting = waitingList(s, department);
  const waitingIds = new Set(waiting.map((c) => c.id));
  return {
    waiting,
    interviewing: all.filter((c) => c.status === 'interviewing'),
    completed: all.filter((c) => c.status === 'completed'),
    no_show: all.filter((c) => c.status === 'no_show'),
  };
}

export function findCandidateByMobile(s: AppState, mobile: string): Candidate | undefined {
  return s.candidates.find((c) => c.mobile === mobile);
}

export function statsOf(s: AppState): AppState['stats'] { return s.stats; }
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd /e/面试排队叫号系统 && npx vitest run tests/engine.test.ts`
Expected: PASS，全部用例绿。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): 纯状态机引擎 + 单测 (register/callNext/recall/reorder/complete)"
```

---

### Task 4: 服务端状态仓库（内存态 + JSON 原子落盘 + 会话）

**Files:**
- Create: `server/store.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: 先写失败测试 tests/store.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createServerStore, type ServerStore } from '@/server/store';
import path from 'node:path';
import fs from 'node:fs';

const TMP = path.join(process.cwd(), '.tmp-store-test');
let store: ServerStore;

beforeEach(() => {
  fs.rmSync(TMP, { force: true });
  store = createServerStore(TMP);
});

describe('ServerStore 持久化', () => {
  it('初始为空状态，revision 可读', () => {
    expect(store.getState().candidates.length).toBe(0);
  });
  it('register 后写入文件；重启 store 读回同一状态', () => {
    const r = store.register({ department: 'A', name: '钱心雨', mobile: '13800000001', wechat: 'wx', gradeClass: '计科2201', note: '' });
    expect(r.created).toBe(true);
    expect(r.candidate.number).toBe('A01');
    const store2 = createServerStore(TMP);
    expect(store2.getState().candidates.length).toBe(1);
    expect(store2.getState().candidates[0].name).toBe('钱心雨');
  });
  it('revision 单调递增', () => {
    const r0 = store.getState().revision;
    store.register({ department: 'B', name: 'x', mobile: '13800000002', wechat: 'w', gradeClass: 'c', note: '' });
    store.callNext('B');
    expect(store.getState().revision).toBeGreaterThan(r0);
  });
  it('密码校验', () => {
    expect(store.verifyPassword('123')).toBe(true);
    expect(store.verifyPassword('wrong')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /e/面试排队叫号系统 && npx vitest run tests/store.test.ts`
Expected: FAIL，"Cannot find module '@/server/store'"。

- [ ] **Step 3: 实现 server/store.ts**

```ts
import fs from 'node:fs';
import path from 'node:path';
import type { AppState, Candidate, DeptCode } from '../shared/types';
import {
  createEmptyState, registerCandidate, callNext as engCallNext, recall as engRecall,
  reorder as engReorder, completeInterview as engComplete, waitingList, type RegisterInput, type ReorderAction,
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
    return JSON.parse(fs.readFileSync(file, 'utf8')) as AppState;
  } catch (e) {
    console.error('[store] 状态文件损坏，用空状态兜底:', e);
    return createEmptyState();
  }
}

export interface ServerStore {
  getState(): AppState;
  persist(): void;
  overwrite(next: AppState): void;   // 供"一键重置/播种演示"用（直接替换并落盘）
  register(input: RegisterInput): RegisterResult;
  callNext(department: DeptCode): AppState;
  recall(department: DeptCode): AppState;
  reorder(department: DeptCode, candidateId: string, action: ReorderAction): AppState;
  complete(candidateId: string): AppState;
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
    callNext: (department) => { const next = engCallNext(state, department); if (next !== state) commit(next); return state; },
    recall: (department) => { const next = engRecall(state, department); if (next !== state) commit(next); return state; },
    reorder: (department, candidateId, action) => { const next = engReorder(state, department, candidateId, action); if (next !== state) commit(next); return state; },
    complete: (candidateId) => { const next = engComplete(state, candidateId); if (next !== state) commit(next); return state; },
    lookupByMobile: (mobile) => state.candidates.filter((c) => c.mobile === mobile),
    verifyPassword: (pw) => pw === (process.env.INTERVIEWER_PASSWORD || '123'),
  };
  return api;
}
```

> 注：`cache/dirty` 为预留优化，v1 采用同步原子写即可满足规模，保留字段避免后续误用；tsconfig noUnusedLocals 已关。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /e/面试排队叫号系统 && npx vitest run tests/store.test.ts`
Expected: PASS。

- [ ] **Step 5: 清理临时测试目录 & Commit**

```bash
rm -rf .tmp-store-test
git add -A && git commit -m "feat(server): JSON 原子落盘状态仓库"
```

---

### Task 5: Express 服务端（REST + 会话 token）

**Files:**
- Create: `server/index.ts`
- Test: `tests/api.test.ts`

- [ ] **Step 1: 先写失败测试 tests/api.test.ts**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '@/server/index';

let app: ReturnType<typeof buildApp>;

beforeAll(() => { app = buildApp({ stateFile: process.cwd() + '/.tmp-api-test.json' }); });

describe('API', () => {
  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  it('POST /api/register 成功 → 返回 created/candidate', async () => {
    const res = await request(app).post('/api/register').send({
      department: 'A', name: '钱心雨', mobile: '13800000001', wechat: 'wx1', gradeClass: '计科2201',
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(true);
    expect(res.body.candidate.number).toBe('A01');
  });
  it('同手机号同部门重复 → created:false 找回', async () => {
    await request(app).post('/api/register').send({ department: 'A', name: '钱心雨', mobile: '13800000001', wechat: 'wx1', gradeClass: '计科2201' });
    const dup = await request(app).post('/api/register').send({ department: 'A', name: '重复', mobile: '13800000001', wechat: 'wx2', gradeClass: '计科2202' });
    expect(dup.body.created).toBe(false);
    expect(dup.body.candidate.name).toBe('钱心雨');
  });
  it('未登录访问面试官端点 → 401', async () => {
    const res = await request(app).post('/api/interviewer/call-next').send({ department: 'A' });
    expect(res.status).toBe(401);
  });
  it('登录(123)后 call-next 可用且 revision 增加', async () => {
    await request(app).post('/api/register').send({ department: 'A', name: '甲', mobile: '13800000002', wechat: 'wx', gradeClass: 'c' });
    const login = await request(app).post('/api/interviewer/login').send({ password: '123' });
    expect(login.status).toBe(200);
    const token = login.body.token;
    const before = (await request(app).get('/api/state')).body.revision;
    const call = await request(app).post('/api/interviewer/call-next').send({ department: 'A' }).set('Authorization', `Bearer ${token}`);
    expect(call.status).toBe(200);
    const after = (await request(app).get('/api/state')).body.revision;
    expect(after).toBeGreaterThan(before);
    expect((await request(app).get('/api/state')).body.announcements.length).toBeGreaterThan(0);
  });
  it('错误密码登录 → 401', async () => {
    const res = await request(app).post('/api/interviewer/login').send({ password: 'bad' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /e/面试排队叫号系统 && npx vitest run tests/api.test.ts`
Expected: FAIL，缺 buildApp。

- [ ] **Step 3: 实现 server/index.ts**

```ts
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { ServerStore } from './store';
import { createServerStore, aheadOf } from './store';

interface Options { stateFile?: string; interviewerPassword?: string }

const SESSIONS = new Set<string>();

export function buildApp(opts: Options = {}) {
  const app = express();
  app.use(express.json());
  const store: ServerStore = createServerStore(opts.stateFile);
  const password = opts.interviewerPassword || process.env.INTERVIEWER_PASSWORD || '123';

  const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!SESSIONS.has(token)) return res.status(401).json({ error: '未授权，请重新登录' });
    next();
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true, revision: store.getState().revision }));

  app.get('/api/state', (_req, res) => res.json(store.getState()));

  app.post('/api/register', (req, res) => {
    try {
      const r = store.register(req.body);
      return res.json({ created: r.created, candidate: r.candidate, ahead: aheadOf(store.getState(), r.candidate) });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/lookup', (req, res) => {
    const mobile = String(req.query.mobile || '');
    const list = store.lookupByMobile(mobile).map((c) => ({ ...c, ahead: aheadOf(store.getState(), c) }));
    res.json(list);
  });

  app.post('/api/interviewer/login', (req, res) => {
    if (req.body.password !== password) return res.status(401).json({ error: '密码错误' });
    const token = crypto.randomBytes(24).toString('hex');
    SESSIONS.add(token);
    res.json({ token });
  });

  app.post('/api/interviewer/call-next', auth, (req, res) => {
    try { const s = store.callNext(req.body.department); res.json({ ok: true, revision: s.revision }); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/interviewer/recall', auth, (req, res) => {
    try { const s = store.recall(req.body.department); res.json({ ok: true, revision: s.revision }); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/interviewer/reorder', auth, (req, res) => {
    try { const s = store.reorder(req.body.department, req.body.candidateId, req.body.action); res.json({ ok: true, revision: s.revision }); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/interviewer/complete', auth, (req, res) => {
    try { const s = store.complete(req.body.candidateId); res.json({ ok: true, revision: s.revision }); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // 生产环境托管前端
  const dist = process.env.STATIC_DIR || path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}

// 直接运行时启动
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const port = Number(process.env.PORT || 3001);
  const app = buildApp();
  app.listen(port, () => console.log(`[server] 面试叫号 API on :${port}`));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /e/面试排队叫号系统 && npx vitest run tests/api.test.ts`
Expected: PASS。

- [ ] **Step 5: 清理 & Commit**

```bash
rm -f .tmp-api-test.json
git add -A && git commit -m "feat(server): Express REST API (health/state/register/lookup/interviewer) + 会话"
```

---

### Task 6: 前端 Store（ServerStore 轮询 / LocalStore 降级）

**Files:**
- Create: `src/lib/store.ts`

- [ ] **Step 1: 实现 src/lib/store.ts**

```ts
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
  reorder(dept: DeptCode, candidateId: string, action: 'top'|'up'|'down'): Promise<void>;
  complete(candidateId: string): Promise<void>;
  lastRegistered(): Candidate | null;
}

/** 探测后端可用性 */
async function probeServer(base = '/api'): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

/** ServerStore：REST + 2s 轮询（由调用方触发 refresh 亦可） */
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
    if (!res.ok) { const err: any = new Error(data.error || `请求失败(${res.status})`); err.status = res.status; throw err; }
    return data;
  };

  const setToken = (t: string) => { token = t; sessionStorage.setItem('iq_token', t); };
  const refreshNow = async () => { state = await call('/api/state'); emit(); };

  return {
    kind: 'server',
    state,
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    refresh: refreshNow,
    register: async (input) => {
      const r = await call('/api/register', 'POST', input);
      await refreshNow();
      return r;
    },
    lookup: async (mobile) => call(`/api/lookup?mobile=${encodeURIComponent(mobile)}`),
    login: async (pw) => { const r = await call('/api/interviewer/login', 'POST', { password: pw }); setToken(r.token); return r.token; },
    callNext: async (dept) => { await call('/api/interviewer/call-next', 'POST', { department: dept }); await refreshNow(); },
    recall: async (dept) => { await call('/api/interviewer/recall', 'POST', { department: dept }); await refreshNow(); },
    reorder: async (dept, candidateId, action) => { await call('/api/interviewer/reorder', 'POST', { department: dept, candidateId, action }); await refreshNow(); },
    complete: async (candidateId) => { await call('/api/interviewer/complete', 'POST', { candidateId }); await refreshNow(); },
    lastRegistered: () => null, // 服务器模式无需本地最近凭条
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
    } catch { /* ignore */ }
    return createEmptyState();
  }

  if (chan) chan.onmessage = (e) => { if (e.data?.revision !== state.revision) { state = e.data.state; emit(); } };

  const bump = (next: AppState) => { state = next; persist(); emit(); if (chan) chan.postMessage({ revision: state.revision, state }); };

  /** 前方真正在等人数（与 server aheadOf 语义一致） */
  const aheadOfLocal = (c: Candidate): number => {
    if (c.status !== 'waiting') return -1;
    const idx = waitingList(state, c.department).findIndex((x) => x.id === c.id);
    return idx === -1 ? -1 : idx;
  };

  return {
    kind: 'local',
    state,
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    refresh: async () => { /* no-op，本地即时 */ },
    register: async (input) => {
      const r = registerCandidate(state, input);
      if (r.created) { bump(r.state); } else { state = r.state; emit(); }
      return { created: r.created, candidate: r.candidate, ahead: aheadOfLocal(r.candidate) };
    },
    lookup: async (mobile) => state.candidates
      .filter((c) => c.mobile === mobile)
      .map((c) => ({ ...c, ahead: aheadOfLocal(c) })),
    login: async (pw) => { if (pw !== (localStorage.getItem(LS_LOCAL_PW) || '123')) throw Object.assign(new Error('密码错误'), { status: 401 }); return 'local-token'; },
    callNext: async (dept) => { bump(callNext(state, dept)); },
    recall: async (dept) => { bump(recall(state, dept)); },
    reorder: async (dept, candidateId, action) => { bump(reorder(state, dept, candidateId, action)); },
    complete: async (candidateId) => { bump(completeInterview(state, candidateId)); },
    lastRegistered: () => null, // 本地模式凭条直接由 register 返回值渲染，无需单独缓存
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
```

> 说明：engine 已在 Task 3 用浏览器/Node 双兼容的 `uuid()`，此处无需再改 shared 逻辑。

- [ ] **Step 2: 运行全量测试确认无回归**

Run: `cd /e/面试排队叫号系统 && npx vitest run`
Expected: PASS（engine + store + api 全绿）。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(frontend): ServerStore/LocalStore 双模式降级 + BroadcastChannel"
```

---

### Task 7: QR 生成工具 + TTS 单例

**Files:**
- Create: `src/lib/qrcode.ts`
- Create: `src/lib/tts.ts`

- [ ] **Step 1: 实现 src/lib/qrcode.ts**

```ts
import QRCode from 'qrcode';

export async function qrDataUrl(text: string, size = 640): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export function registerUrl(): string {
  const { origin, pathname } = window.location;
  const base = (origin + pathname).replace(/\/$/, '');
  return `${base}/?view=register`;
}
```

- [ ] **Step 2: 实现 src/lib/tts.ts**（中文发音人优选、队列、去重、静音开关、只在新公告触发）

```ts
export class TTS {
  private enabled = true;
  private queue: { text: string; onDone?: () => void }[] = [];
  private speaking = false;
  private lastSpoken: number | null = null;   // 公告 id 去重
  private lastSpokenText = '';

  constructor() { this.loadVoices(); if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => this.loadVoices(); }

  private voices: SpeechSynthesisVoice[] = [];
  private loadVoices() {
    if (!('speechSynthesis' in window)) return;
    this.voices = speechSynthesis.getVoices();
  }
  private pickChinese(): SpeechSynthesisVoice | undefined {
    const list = this.voices.length ? this.voices : ('speechSynthesis' in window ? speechSynthesis.getVoices() : []);
    const zh = list.filter((v) => /zh|cmn|chinese|普通话|中文/i.test(`${v.lang} ${v.name}`));
    const score = (v: SpeechSynthesisVoice) =>
      (/^zh-CN/i.test(v.lang) ? 3 : 0) + (/普通话|Xiaoxiao|Huihui|Tingting|Yunxi|Yunyang/i.test(v.name) ? 2 : 0) + (/zh/i.test(v.lang) ? 1 : 0);
    return zh.sort((a, b) => score(b) - score(a))[0];
  }

  setEnabled(on: boolean) { this.enabled = on; if (!on) this.stop(); }
  isEnabled() { return this.enabled; }

  /** 播放一段文本（入队） */
  speak(text: string, onDone?: () => void) {
    if (!this.enabled || !('speechSynthesis' in window)) { onDone?.(); return; }
    this.queue.push({ text, onDone });
    this.pump();
  }

  /** 公告专用：同一公告只播一次；返回是否真的会播 */
  announce(id: number, text: string, force = false): boolean {
    if (!force && this.lastSpoken === id) return false;
    this.lastSpoken = id;
    this.lastSpokenText = text;
    this.speak(text);
    return true;
  }

  replayLast() { if (this.lastSpokenText) this.speak(this.lastSpokenText); }

  private pump() {
    if (this.speaking || !this.queue.length) return;
    const item = this.queue.shift()!;
    this.speaking = true;
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'zh-CN';
    const voice = this.pickChinese();
    if (voice) u.voice = voice;
    u.rate = 1;
    u.onend = () => { this.speaking = false; this.pump(); item.onDone?.(); };
    u.onerror = () => { this.speaking = false; this.pump(); item.onDone?.(); };
    speechSynthesis.speak(u);
  }
  stop() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.queue = []; this.speaking = false;
  }
}

export const tts = new TTS();
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(lib): qrcode 生成 + TTS 单例(中文优选/队列/去重)"
```

---

### Task 8: 全局 Shell、路由分发与共享 UI 组件

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/DeptBadge.tsx`
- Create: `src/components/QrCard.tsx`
- Create: `src/components/PollProvider.tsx`
- Create: `src/views/screen/ScreenView.tsx`（Task 9 细化，先建占位）
- Create: `src/views/register/RegisterView.tsx`（Task 10）
- Create: `src/views/interviewer/InterviewerView.tsx`（Task 11）

- [ ] **Step 1: 实现 src/App.tsx（view 分发 + 顶部降级提示 + 轮询上下文）**

```tsx
import { useEffect, useState } from 'react';
import type { FrontStore } from '@/lib/store';
import { getStore } from '@/lib/store';
import ScreenView from '@/views/screen/ScreenView';
import RegisterView from '@/views/register/RegisterView';
import InterviewerView from '@/views/interviewer/InterviewerView';

function useView(): string {
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'screen');
  useEffect(() => {
    const onPop = () => setView(new URLSearchParams(window.location.search).get('view') || 'screen');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return view;
}

export default function App() {
  const view = useView();
  const [store, setStore] = useState<FrontStore | null>(null);
  const [, setVersion] = useState(0); // 订阅 store 变化强制重渲染

  useEffect(() => { getStore().then((s) => { setStore(s); s.refresh().catch(() => {}); }); }, []);
  useEffect(() => {
    if (!store) return;
    const unsub = store.subscribe(() => setVersion((v) => v + 1));
    const timer = setInterval(() => { store.refresh().catch(() => {}); }, 2000);
    return () => { unsub(); clearInterval(timer); };
  }, [store]);

  if (!store) return <div className="grid h-full place-items-center text-slate-500">加载中…</div>;

  return (
    <div className="h-full">
      {store.kind === 'local' && (
        <div className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-800">离线演示模式：后端未连接，数据仅存本机浏览器</div>
      )}
      {view === 'screen' && <ScreenView store={store} />}
      {view === 'register' && <RegisterView store={store} />}
      {view === 'interviewer' && <InterviewerView store={store} />}
    </div>
  );
}
```

- [ ] **Step 2: 实现 src/components/DeptBadge.tsx**

```tsx
import { DEPT_MAP, DEPT_COLOR } from '@/shared/constants';
import type { DeptCode } from '@/shared/types';

export default function DeptBadge({ code, size = 'md' }: { code: DeptCode; size?: 'sm' | 'md' | 'lg' }) {
  const d = DEPT_MAP[code]; const c = DEPT_COLOR[code];
  const pad = size === 'lg' ? 'px-4 py-1.5 text-lg' : size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg font-bold text-white ${c.bg} ${pad}`}>
      <span>{code}</span><span>{d.name}</span>
    </span>
  );
}
```

- [ ] **Step 3: 实现 src/components/QrCard.tsx**

```tsx
import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { qrDataUrl, registerUrl } from '@/lib/qrcode';

export default function QrCard({ className = '', zoomable = true }: { className?: string; zoomable?: boolean }) {
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(false);
  useEffect(() => { qrDataUrl(registerUrl(), 720).then(setUrl); }, []);
  if (zoom) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setZoom(false)}>
        <div className="max-w-3xl rounded-3xl bg-white p-8 text-center">
          {url && <img src={url} alt="扫码取号" className="mx-auto w-[70vmin]" />}
          <p className="mt-4 text-2xl font-bold text-slate-800">微信 / 相机扫码 · 在线取号排队</p>
          <button className="mt-4 text-slate-500 underline">点击任意处关闭</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center rounded-2xl bg-white p-4 shadow ${className}`}>
      {url ? <img src={url} alt="扫码取号" className="w-full" /> : <div className="grid aspect-square w-full place-items-center"><QrCode className="h-16 w-16 text-slate-300" /></div>}
      <p className="mt-3 text-center font-bold text-slate-800">微信 / 相机扫码 · 在线取号排队</p>
      {zoomable && <button onClick={() => setZoom(true)} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">全屏放大二维码</button>}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(frontend): view 分发 + 轮询 + 二维码/部门徽章组件"
```

---

### Task 9: 等候室大屏视图（教208）

**Files:**
- Create: `src/views/screen/ScreenView.tsx`
- Create: `src/views/screen/DeptColumn.tsx`
- Create: `src/views/screen/AnnounceBar.tsx`

- [ ] **Step 1: 实现 DeptColumn.tsx**（某部门：当前面试中 / 等待队列 / 已完成）

```tsx
import { useEffect, useState } from 'react';
import { Clock, UserCheck, Users } from 'lucide-react';
import type { AppState, Candidate, DeptCode } from '@/shared/types';
import { DEPT_MAP, DEPT_COLOR, WAIT_ROOM } from '@/shared/constants';
import { listByStatus } from '@/shared/engine';
import DeptBadge from '@/components/DeptBadge';

function Elapsed({ start }: { start?: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  if (!start) return null;
  const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return <span className="ml-1 inline-flex items-center gap-1 text-sm"><Clock className="h-4 w-4" />{mm}:{ss}</span>;
}

export default function DeptColumn({ state, code }: { state: AppState; code: DeptCode }) {
  const d = DEPT_MAP[code]; const c = DEPT_COLOR[code];
  const { interviewing, waiting, completed } = listByStatus(state, code);
  const current = interviewing[0];

  return (
    <section className={`flex min-h-0 flex-col rounded-2xl border-t-4 ${c.border} bg-white shadow`}>
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2"><DeptBadge code={code} /><span className="text-lg font-black">{d.name}</span></div>
        <div className="text-sm text-slate-500">考场 {d.room} · 候考室 {WAIT_ROOM}</div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 px-4 pb-3">
        {/* 面试中 */}
        <div className={`rounded-xl ${c.soft} border ${c.border} p-3`}>
          <div className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500"><UserCheck className="h-3.5 w-3.5" />面试中</div>
          {current ? (
            <div className="flex items-end justify-between">
              <div>
                <div className={`text-4xl font-black ${c.text}`}>{current.number}</div>
                <div className="text-xl font-bold">{current.name} · {current.gradeClass}</div>
              </div>
              <Elapsed start={current.interviewStartedAt} />
            </div>
          ) : <div className="py-4 text-center text-slate-400">— 暂无面试 —</div>}
        </div>

        {/* 等待队列 */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500"><Users className="h-3.5 w-3.5" />等待面试 · {waiting.length}人</div>
          <ol className="space-y-1.5">
            {waiting.length === 0 && <li className="text-center text-sm text-slate-400">暂无等待</li>}
            {waiting.map((w, i) => (
              <li key={w.id} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${i === 0 ? 'bg-white font-bold ring-1 ring-amber-300' : 'bg-white/60'}`}>
                <span className="font-mono text-base font-bold text-slate-800">{w.number}</span>
                <span className="truncate text-slate-700">{w.name}</span>
                {i === 0 && <span className="rounded bg-amber-400 px-1.5 text-xs font-bold text-white">下一位</span>}
              </li>
            ))}
          </ol>
        </div>

        {/* 已完成 */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 text-xs font-bold text-slate-500">已面试完 · {completed.length}</div>
          <div className="flex flex-wrap gap-1">
            {completed.slice(-12).reverse().map((cand) => <span key={cand.id} className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">{cand.number} {cand.name}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 实现 AnnounceBar.tsx**（最新公告高亮 + 语音控制 + 重播）

```tsx
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, RotateCcw, Megaphone } from 'lucide-react';
import type { AppState } from '@/shared/types';
import { DEPT_COLOR } from '@/shared/constants';
import { tts } from '@/lib/tts';

export default function AnnounceBar({ state }: { state: AppState }) {
  const last = state.announcements[state.announcements.length - 1];
  const [, force] = useState(0); // 让 isEnabled 状态可刷新
  const spoken = useRef<number | null>(null);

  // 仅在出现"新公告"时自动播报；同 id 不重播（静音期间也不追播）
  useEffect(() => {
    if (last && last.id !== spoken.current && tts.isEnabled()) {
      spoken.current = last.id;
      tts.announce(last.id, last.text);
    }
  }, [last]); // eslint-disable-line

  const toggleVoice = () => { tts.setEnabled(!tts.isEnabled()); force((x) => x + 1); };
  const enabled = tts.isEnabled();

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><Megaphone className="h-5 w-5 text-rose-500" />实时叫号播报</div>
        <div className="flex items-center gap-2">
          <button onClick={() => tts.replayLast()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50" title="重播"><RotateCcw className="h-4 w-4" />重播</button>
          <button onClick={toggleVoice} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-white ${enabled ? 'bg-slate-700' : 'bg-slate-400'}`}>
            {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}{enabled ? '语音开' : '语音关'}
          </button>
        </div>
      </div>
      {last ? (
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-white px-4 py-4 ring-1 ring-blue-200">
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl font-black text-white ${DEPT_COLOR[last.department].bg}`}>{last.department}</div>
          <div className="text-3xl font-black leading-tight text-slate-900">{last.text}</div>
        </div>
      ) : <div className="py-6 text-center text-xl text-slate-400">等待面试官呼叫…（扫码可在线取号排队）</div>}
    </div>
  );
}
```

> 语音触发规则：仅当出现**新公告 id 且语音开关开启**才自动播；静音期间的公告会被 `spoken` 记下，重开音量不追播历史。面试官点「再次呼叫」在后端生成新 id → 若大屏语音开启即自动重播；若大屏静音则不响（符合"仅面试官点击后、大屏开启时发声"的约束）。

- [ ] **Step 3: 实现 ScreenView.tsx**

```tsx
import { DEPARTMENTS } from '@/shared/constants';
import type { FrontStore } from '@/lib/store';
import QrCard from '@/components/QrCard';
import AnnounceBar from './AnnounceBar';
import DeptColumn from './DeptColumn';

export default function ScreenView({ store }: { store: FrontStore }) {
  const s = store.state;
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* 顶部指引 */}
      <header className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 shadow">
        <div className="flex items-center gap-2"><span className="rounded-lg bg-rose-600 px-3 py-1 text-lg font-black text-white">当前所在：教208 · 候考等候室</span></div>
        <div className="flex gap-3 text-sm font-bold text-slate-600">
          <span>📍 事业部 &amp; 综务部 <span className="text-blue-700">➜ 教210</span></span>
          <span>📍 信技部 &amp; 宣传部 <span className="text-orange-600">➜ 教211</span></span>
        </div>
      </header>

      {/* 中部：左二维码 + 右叫号 */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        <div className="col-span-2 min-h-0"><QrCard className="h-full" /></div>
        <div className="col-span-10 min-h-0 flex flex-col gap-3"><AnnounceBar state={s} /></div>
      </div>

      {/* 4 部门看板 */}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-3">
        {DEPARTMENTS.map((d) => <DeptColumn key={d.code} state={s} code={d.code} />)}
      </div>

      {/* 底部统计 */}
      <footer className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 text-sm shadow">
        <span className="font-bold text-slate-700">总登记 {s.stats.total} · 面试中 {s.stats.interviewing} · 等候中 {s.stats.waiting} · 已完成 {s.stats.completed}</span>
        <span className="text-slate-400">面试排队叫号系统 · 数据实时同步</span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(screen): 等候室大屏（二维码+叫号播报+4部门看板+统计）"
```

---

### Task 10: 手机登记 / 进度查询视图

**Files:**
- Create: `src/views/register/RegisterView.tsx`

- [ ] **Step 1: 实现 RegisterView.tsx**（两段：选部门+表单 → 凭条；底部"查我的进度"）

```tsx
import { useState, type ChangeEvent } from 'react';
import type { Candidate, DeptCode } from '@/shared/types';
import { DEPARTMENTS, DEPT_MAP, DEPT_COLOR, WAIT_ROOM } from '@/shared/constants';
import type { FrontStore, LookupCandidate } from '@/lib/store';
import { ArrowLeft, CheckCircle2, Search, Ticket } from 'lucide-react';

type Phase = 'form' | 'ticket' | 'query';

export default function RegisterView({ store }: { store: FrontStore }) {
  const [phase, setPhase] = useState<Phase>('form');
  const [dept, setDept] = useState<DeptCode | ''>('');
  const [form, setForm] = useState({ name: '', mobile: '', wechat: '', gradeClass: '', note: '' });
  const [err, setErr] = useState('');
  const [ticket, setTicket] = useState<{ created: boolean; candidate: Candidate; ahead: number } | null>(null);
  const [results, setResults] = useState<LookupCandidate[]>([]);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setErr('');
    try {
      const r = await store.register({ department: dept as DeptCode, ...form });
      setTicket(r); setPhase('ticket');
    } catch (e: any) { setErr(e.message); }
  }
  async function query() {
    setErr('');
    try { setResults(await store.lookup(qMobile)); setPhase('query'); } catch (e: any) { setErr(e.message); }
  }

  if (phase === 'query') {
    return (
      <div className="mx-auto max-w-md p-4">
        <BackBtn onClick={() => setPhase('form')} label="返回登记" />
        <h1 className="mb-3 text-xl font-bold">我的排队进度</h1>
        {results.length === 0 && <div className="rounded-xl bg-white p-6 text-center text-slate-400">未找到该手机号的记录</div>}
        <div className="space-y-2">
          {results.map((c) => {
            const d = DEPT_MAP[c.department]; const col = DEPT_COLOR[c.department];
            const statusText = { waiting: '等待面试', interviewing: '面试中', completed: '已面试完', no_show: '已过号' }[c.status];
            return (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow">
                <div className="flex items-center justify-between">
                  <span className={`text-3xl font-black ${col.text}`}>{c.number}</span>
                  <span className={`rounded-lg px-2 py-0.5 text-sm font-bold ${c.status === 'interviewing' ? 'bg-rose-100 text-rose-700' : c.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : c.status === 'waiting' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>{statusText}</span>
                </div>
                <p className="mt-1 text-slate-700">{c.name} · {c.gradeClass}</p>
                <p className="text-sm text-slate-500">{d.name} · 面试教室 {d.room}</p>
                {c.status === 'waiting' && c.ahead >= 0 && <p className="mt-2 font-bold text-slate-700">前方还有 {c.ahead} 人等待</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === 'ticket' && ticket) {
    const c = ticket.candidate; const d = DEPT_MAP[c.department]; const col = DEPT_COLOR[c.department];
    return (
      <div className="mx-auto max-w-md p-4">
        <BackBtn onClick={() => setPhase('form')} label="再取一个号" />
        <div className={`overflow-hidden rounded-2xl border-t-8 bg-white shadow ${col.border}`}>
          <div className={`flex items-center gap-2 px-4 py-3 text-white ${col.bg}`}><Ticket className="h-5 w-5" />{ticket.created ? '取号成功' : '您已取过号，找回凭条'}</div>
          <div className="p-5">
            <div className="text-center"><div className="text-sm text-slate-500">您的排队号码</div><div className={`text-6xl font-black ${col.text}`}>{c.number}</div></div>
            <dl className="mt-4 space-y-2 text-slate-700">
              <Row k="姓名" v={c.name} /><Row k="申请部门" v={`${d.name}`} /><Row k="面试教室" v={`${d.room}（候考室 ${WAIT_ROOM}）`} />
              <Row k="年级专业班级" v={c.gradeClass} />
              {c.status === 'waiting' ? <Row k="前方等待" v={`${ticket.ahead >= 0 ? ticket.ahead : 0} 人`} /> : <Row k="当前状态" v="已进入面试/已完成" />}
            </dl>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />请在候考室（教208）留意大屏叫号与语音播报，轮到您时前往对应教室。</div>
          </div>
        </div>
        <QueryForm onQuery={query} />
      </div>
    );
  }

  // form
  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="text-xl font-bold">面试在线取号</h1>
      <p className="mb-3 text-sm text-slate-500">请先选择您要面试的部门</p>
      <div className="grid grid-cols-2 gap-2">
        {DEPARTMENTS.map((d) => {
          const waiting = store.state.candidates.filter((c) => c.department === d.code && c.status === 'waiting').length;
          const sel = dept === d.code;
          const col = DEPT_COLOR[d.code];
          return (
            <button key={d.code} onClick={() => setDept(d.code)} className={`rounded-2xl border-2 bg-white p-3 text-left shadow-sm transition ${sel ? `${col.border} ${col.soft}` : 'border-transparent'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white ${col.bg}`}>{d.code}</div>
              <div className="mt-2 font-bold">{d.name}</div>
              <div className="text-xs text-slate-500">教室 {d.room}</div>
              <div className="mt-1 text-xs font-bold text-slate-600">当前等待 {waiting} 人</div>
            </button>
          );
        })}
      </div>

      {dept && (
        <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow">
          <h2 className="font-bold">填写信息（{DEPT_MAP[dept].name}）</h2>
          <Field label="真实姓名 *"><input className={inp} value={form.name} onChange={set('name')} placeholder="请输入姓名" /></Field>
          <Field label="11 位手机号 *"><input className={inp} inputMode="numeric" maxLength={11} value={form.mobile} onChange={set('mobile')} placeholder="用于进度查询与找回凭条" /></Field>
          <Field label="微信号 *"><input className={inp} value={form.wechat} onChange={set('wechat')} placeholder="请输入微信号" /></Field>
          <Field label="年级与专业班级 *"><input className={inp} value={form.gradeClass} onChange={set('gradeClass')} placeholder="如：计科2201 / 机械2402" /></Field>
          <Field label="个人经历及特长（选填）"><textarea className={`${inp} min-h-20`} value={form.note} onChange={set('note')} placeholder="简要描述经历或特长" /></Field>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button onClick={submit} disabled={!dept || !form.name || !/^1[3-9]\d{9}$/.test(form.mobile) || !form.wechat || !form.gradeClass}
            className="w-full rounded-xl bg-blue-600 py-3 text-lg font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300">提交取号</button>
        </div>
      )}

      <QueryForm onQuery={query} />
    </div>
  );
}

const inp = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none';
const Field = ({ label, children }: any) => (<label className="block text-sm font-semibold text-slate-700">{label}<div className="mt-1">{children}</div></label>);
const Row = ({ k, v }: any) => (<div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5"><dt className="text-slate-400">{k}</dt><dd className="font-bold">{v}</dd></div>);
const BackBtn = ({ onClick, label }: any) => (<button onClick={onClick} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />{label}</button>);

function QueryForm({ onQuery }: { onQuery: (mobile: string) => void }) {
  const [m, setM] = useState('');
  return (
    <div className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-3 shadow">
      <Search className="h-5 w-5 text-slate-400" />
      <input className="min-w-0 flex-1 border-0 bg-transparent outline-none" placeholder="输入手机号查排队进度" inputMode="numeric" maxLength={11} value={m} onChange={(e) => setM(e.target.value)} />
      <button onClick={() => onQuery(m)} className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={!/^1[3-9]\d{9}$/.test(m)}>查询</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(register): 手机扫码登记/出凭条/进度查询"
```

---

### Task 11: 面试官控制台（登录 + 调度）

**Files:**
- Create: `src/views/interviewer/InterviewerView.tsx`

- [ ] **Step 1: 实现 InterviewerView.tsx**

```tsx
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, LogOut, SkipForward, Sparkles, Square, PhoneForwarded } from 'lucide-react';
import type { AppState, Candidate, DeptCode } from '@/shared/types';
import { DEPARTMENTS, DEPT_COLOR } from '@/shared/constants';
import { listByStatus } from '@/shared/engine';
import type { FrontStore } from '@/lib/store';

export default function InterviewerView({ store }: { store: FrontStore }) {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('iq_token') || store.kind === 'local');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [acting, setActing] = useState(false);
  const s = store.state;

  const act = async (fn: () => Promise<void>) => { if (acting) return; setActing(true); try { await fn(); } finally { setActing(false); } };

  if (!authed) return <Login store={store} onOk={() => setAuthed(true)} />;

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-black">面试官调度控制台</h1>
        <button onClick={() => { sessionStorage.removeItem('iq_token'); setAuthed(false); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><LogOut className="h-4 w-4" />登出</button>
      </header>
      <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">叫号将即时同步到等候室大屏并语音播报（需大屏端语音开启）。</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {DEPARTMENTS.map((d) => {
          const col = DEPT_COLOR[d.code];
          const { interviewing, waiting } = listByStatus(s, d.code);
          const current = interviewing[0];
          return (
            <section key={d.code} className={`rounded-2xl border ${col.border} bg-white shadow`}>
              <header className={`flex items-center justify-between rounded-t-2xl ${col.soft} border-b px-4 py-2`}>
                <div className="font-black">{d.name} <span className="text-sm font-normal text-slate-500">（教室 {d.room}）</span></div>
                <button disabled={waiting.length === 0} onClick={() => act(() => store.callNext(d.code))}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold text-white disabled:opacity-40 ${col.bg}`}>
                  <PhoneForwarded className="h-4 w-4" />呼叫下一位
                </button>
              </header>

              <div className="p-3">
                {current ? (
                  <div className={`mb-3 rounded-xl ${col.soft} p-3`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold">面试中：<span className="text-lg">{current.number} {current.name}</span> <span className="ml-1 text-xs text-slate-500">{current.gradeClass}</span></div>
                      <div className="flex gap-1">
                        <button onClick={() => act(() => store.recall(d.code))} title="再次呼叫（催场）" className={`rounded-lg bg-white px-2 py-1 text-xs font-bold ${col.text} ring-1 ${col.border}`}>再次呼叫</button>
                        <button onClick={() => act(() => store.complete(current.id))} title="结束当前面试" className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">完成</button>
                      </div>
                    </div>
                    {current.note && <p className="mt-1 text-sm text-slate-600">备注：{current.note}</p>}
                  </div>
                ) : <div className="mb-3 rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-400">暂无面试中</div>}

                <div className="text-xs font-bold text-slate-500">等待队列（{waiting.length}）· 置顶/上移/下移调整优先级</div>
                <ul className="mt-1 divide-y divide-slate-100">
                  {waiting.map((w, i) => (
                    <CandidateRow key={w.id} cand={w} idx={i} len={waiting.length} dept={d.code} store={store} act={act}
                      expanded={!!expanded[w.id]} onToggle={() => setExpanded((e) => ({ ...e, [w.id]: !e[w.id] }))} />
                  ))}
                  {waiting.length === 0 && <li className="py-3 text-center text-sm text-slate-400">队列为空</li>}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CandidateRow({ cand, idx, len, dept, store, act, expanded, onToggle }: {
  cand: Candidate; idx: number; len: number; dept: DeptCode; store: FrontStore;
  act: (fn: () => Promise<void>) => Promise<void>; expanded: boolean; onToggle: () => void;
}) {
  const col = DEPT_COLOR[dept];
  const reorder = (action: 'top' | 'up' | 'down') => act(() => store.reorder(dept, cand.id, action));
  return (
    <li className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`font-mono text-base font-black ${col.text}`}>{cand.number}</span>
          <span className="truncate font-bold">{cand.name}</span>
          <span className="truncate text-xs text-slate-400">{cand.gradeClass}</span>
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <MiniBtn title="置顶" onClick={() => reorder('top')}><Sparkles className="h-3.5 w-3.5" /></MiniBtn>
          <MiniBtn title="上移" disabled={idx === 0} onClick={() => reorder('up')}><ArrowUp className="h-3.5 w-3.5" /></MiniBtn>
          <MiniBtn title="下移" disabled={idx === len - 1} onClick={() => reorder('down')}><ArrowDown className="h-3.5 w-3.5" /></MiniBtn>
        </div>
      </div>
      {expanded && (
        <div className="mt-1.5 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
          <p>手机号 {cand.mobile} · 微信号 {cand.wechat}</p>
          <p>登记于 {new Date(cand.registeredAt).toLocaleString('zh-CN')}</p>
          {cand.note && <p>备注：{cand.note}</p>}
        </div>
      )}
    </li>
  );
}

const MiniBtn = ({ children, onClick, disabled, title }: any) => (
  <button title={title} onClick={onClick} disabled={disabled} className="rounded border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">{children}</button>
);

function Login({ store, onOk }: { store: FrontStore; onOk: () => void }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  async function go() { try { await store.login(pw); onOk(); } catch (e: any) { setErr(e.status === 401 ? '密码错误' : e.message); } }
  return (
    <div className="grid h-full place-items-center bg-slate-100">
      <form onSubmit={(e) => { e.preventDefault(); go(); }} className="w-72 rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-1 text-xl font-black">面试官登录</h1>
        <p className="mb-4 text-xs text-slate-400">请联系考务人员获取访问密码</p>
        <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="请输入密码" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
        <button type="submit" className="mt-4 w-full rounded-lg bg-slate-800 py-2.5 font-bold text-white hover:bg-slate-900">登 录</button>
      </form>
    </div>
  );
}
```

> 说明：LocalStore 无 token 概念，登录直接通过；LocalStore 的 login 密码默认亦为 123（可在 localStorage `iq_local_pw` 覆盖）。UI 不显示任何密码提示。

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(interviewer): 密码登录 + 调度(呼叫/再次呼叫/完成/置顶上移下移) + 详情"
```

---

### Task 12: 演示数据、README、构建与联调验收

**Files:**
- Create: `server/demo.ts`
- Modify: `server/index.ts`（启动时若无状态文件则播种演示数据，仅生产/start 时）
- Create: `README.md`
- Modify: `.gitignore`（保持 data/ 忽略）

- [ ] **Step 1: 实现 server/demo.ts（演示候选 + 一键播种）**

```ts
import type { AppState } from '../shared/types';
import { createEmptyState, registerCandidate, callNext } from '../shared/engine';

/** 生成一套可视化的演示状态：4 部门各若干等待 + 1-2 个进行中 + 已完成 */
export function demoState(now = Date.now()): AppState {
  let s = createEmptyState();
  const names: Record<string, string[]> = {
    A: ['钱心雨', '李文博', '赵一凡', '孙静', '周子墨'],
    B: ['吴思远', '郑晓雪', '王浩宇', '陈佳琳'],
    C: ['刘子轩', '杨雨欣', '黄明哲', '张诗涵', '林俊凯', '罗雨桐'],
    D: ['徐艺洋', '高远航', '宋佳音', '唐启明'],
  };
  let i = 0;
  (Object.keys(names) as Array<'A'|'B'|'C'|'D'>).forEach((dept) => {
    names[dept].forEach((name, j) => {
      const r = registerCandidate(s, {
        department: dept, name, mobile: `138${String(10000000 + i * 137).slice(0, 8)}`,
        wechat: `wx_${dept}_${j + 1}`, gradeClass: j % 2 ? '计科2401' : '机械2302', note: j % 3 === 0 ? '有学生会干部经历' : '', now: now - (10 - j) * 60000,
      });
      s = r.state; i += 1;
    });
  });
  // 每部门呼叫 2 位让看板有"面试中 + 已完成"
  (['A', 'B', 'C', 'D'] as const).forEach((dept) => { s = callNext(s, dept, now - 3 * 60000); s = callNext(s, dept, now - 1 * 60000); });
  return s;
}
```

- [ ] **Step 2: 在 server/index.ts 接入演示播种**

`buildApp` 增加选项 `seedDemo?: boolean`。在创建 store 后、各路由注册前执行：若 `seedDemo` 且 store 当前为空（无候选人），则用 `demoState()` 覆盖一次。具体在 `server/index.ts`：

```ts
import { demoState } from './demo';
// Options 增加：seedDemo?: boolean
// buildApp 内 createServerStore 之后：
if (opts.seedDemo && store.getState().candidates.length === 0) {
  store.overwrite(demoState());
  console.log('[server] 已播种演示数据（队列为空时）');
}
```

直接运行的启动处默认 seed（本地预览友好），生产显式关：

```ts
if (isMain) {
  const port = Number(process.env.PORT || 3001);
  const seedDemo = process.env.SEED_DEMO === '1' || process.env.NODE_ENV !== 'production';
  const app = buildApp({ seedDemo });
  app.listen(port, () => console.log(`[server] 面试叫号 API on :${port}`));
}
```

同时 `Options` 接口与 `buildApp` 解构参数需加 `seedDemo = false`。演示播种仅当**状态文件为空队列**时生效，不覆盖已开始的真实数据。

- [ ] **Step 3: 写 README.md**

覆盖：简介、三视图 URL、本地启动步骤（`npm run dev:all`）、手机真机调试（局域网 IP 访问、二维码自动指向当前 origin）、部署(同窝里蹲 Docker 复用思路)、默认密码如何配置、测试命令。

- [ ] **Step 4: 联调验收（手动清单）**

Run: `cd /e/面试排队叫号系统 && npm run dev:all`
浏览器开 3 个标签：
1. `http://localhost:3000/` → 大屏：二维码出现、4 部门看板显示演示"面试中/等待/已完成"。
2. `http://localhost:3000/?view=register` → 选部门→填表→提交出凭条；同手机号重复提交 → 找回凭条；手机号框查进度。
3. `http://localhost:3000/?view=interviewer` → 密码 123 登录（页面无提示）→ 点「呼叫下一位」→ 切到大屏标签看到新公告高亮 + （语音开启则）播报；点再次呼叫 → 大屏重播。

预期：三端数据一致，revision 驱动刷新 ≤2s；面试中/已完成随叫号流转正确。

- [ ] **Step 5: 构建生产版并单进程起服务验证**

Run: `npm run build && SEED_DEMO=1 PORT=3001 npm start`
访问 `http://localhost:3001/?view=screen` 确认静态托管 + API 同源生效。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 演示数据/README/联调验收"
```

---

## 验收标准汇总

1. 三端视图经 `?view=` 自由切换且数据一致（大屏/手机/控制台）。
2. 手机登记自动生成 A01/B01… 序号；同手机号同部门未完成 → 找回凭条不重发。
3. 面试官点「呼叫下一位」→ 队首进入面试中、原面试中自动完成、大屏高亮并语音（语音开启时）。
4. 语音仅在大屏机发声、仅在面试官动作后触发（新增公告 id）；登记/刷新/轮询均不发声。
5. 置顶/上移/下移改变呼叫顺序。
6. 后端挂掉 → 界面降级 localStorage 演示模式不崩溃。
7. `npm run test` 全绿；`npx tsc --noEmit` 无类型错误。

## 后续（v2，不在本计划）
- 脱敏/全显切换、播报历史抽屉、评分/录用淘汰 UI、候选人编辑/手动录入、教室/面试官维护界面、统计图表、真实部署脚本（沿用窝里蹲 deploy.cjs 思路）。
