# 面试排队叫号系统 · 设计文档

- **日期**: 2026-09-07
- **状态**: v1 范围锁定（最小闭环 + 语音 + 调度）
- **技术栈**: React 19 + TypeScript + Tailwind CSS v4 + lucide-react + `qrcode` + Web Speech API；Express 轻后端 + JSON 文件持久化

## 1. 目标与范围（v1）

一个可在局域网/服务器运行的面试叫号网页，三个视图经 `?view=` 切换，状态经轻后端共享、多屏一致。

**v1 保留**（按确认的最小闭环 + 语音 + 调度）：

1. **等候室大屏**：常驻大二维码 + 4 部门看板（面试者名字按 等待/面试中/已完成 分组、实时刷新）+ 叫号高亮横幅 + 语音播报（开关/重播）。
2. **手机登记端**：扫码 → 选部门 → 填 姓名/手机/微信/班级 → 自动出号 → 电子凭条（号码/教室/前方人数/状态）+ 同手机号防重复找回。
3. **面试官控制端**：密码登录（默认 `123`，可配置）→ 每部门「呼叫下一位 / 再次呼叫」+ 队列优先级调度（置顶/上移/下移）。

**v1 明确不做**（后续再说）：评分/评语/录用淘汰、候选人信息编辑与手动录入、部门教室/面试官维护界面、清空/重置按钮的完整管理界面、播报历史抽屉、全屏二维码弹窗、短信/推送通知。

> 例外：为保证演示可复现，服务端内置「演示数据 + 一键重置」仅作为后端初始化/测试辅助，不入管理 UI 正题。

## 2. 考场与部门配置（常量，v1 不改）

| code | 部门 | 面试教室 | 等候室 |
|---|---|---|---|
| A | 事业部 | 教210 | 教208 |
| B | 综务部 | 教210 | 教208 |
| C | 信技部 | 教211 | 教208 |
| D | 宣传部 | 教211 | 教208 |

排号前缀 = 部门 code（A/B/C/D），每部门独立自增序号，3 位零填充（A01、A02…）。

## 3. 架构

### 3.1 运行形态（本地开发优先，可平滑演进为全栈部署）

```
E:\面试排队叫号系统\
├─ index.html / package.json / vite.config.ts / tsconfig*.json
├─ server/
│  ├─ index.ts        # Express 入口：挂 /api/*，NODE_ENV=production 时托管 dist/ + SPA fallback
│  ├─ store.ts        # 单例状态 + JSON 原子持久化 (data/state.json) + revision 递增
│  └─ routes.ts       # 所有 REST 端点
├─ data/state.json    # 运行时生成（.gitignore）
├─ src/
│  ├─ main.tsx / App.tsx        # ?view= 分发
│  ├─ types.ts                  # 领域类型 + 状态机
│  ├─ api.ts                    # fetch 封装 + 后端可用性探测
│  ├─ store/
│  │  ├─ types.ts               # Store 接口
│  │  ├─ ServerStore.ts         # REST + 2s 轮询
│  │  └─ LocalStore.ts          # localStorage + BroadcastChannel 兜底
│  ├─ speech/tts.ts             # window.speechSynthesis 单例
│  ├─ lib/qrcode.ts             # qrcode → DataURL
│  ├─ views/screen/  register/  interviewer/
│  └─ components/               # 跨视图复用（QR 卡、凭条、部门色板）
└─ docs/
```

脚本（沿用窝里蹲已验证范式）：`dev`(Vite :3000) · `dev:server`(Express :3001) · `dev:all` · `build` · `start`(单进程生产)。

### 3.2 Store 双模式与降级

- 前端启动 `GET /api/health`：成功 → `ServerStore`（2s 轮询 `/api/state`，写操作打 API）；失败 → `LocalStore`（localStorage 读写 + BroadcastChannel 同机标签页联动，演示闭环不中断）。
- 视图层只依赖 Store 接口，不感知后端是否存在。

### 3.3 并发与一致性

写操作全在 Express 单进程内串行执行（Node 单线程）；每次成功写操作 `revision++` + JSON 原子落盘（写临时文件后 rename）。轮询端对比 `revision` 判变，变了才刷新/触发播报。规模小，无需数据库、无竞争问题。

## 4. 领域模型与状态机

### 4.1 状态机（每部门同时最多 1 人在 `interviewing`）

```
register ─► waiting ──call-next──► interviewing ──call-next(轮换)──► completed
               │                      │
               │  recall: 不改状态，仅再生成一次播报公告
               ▼
           no_show（缺席/过号，可选操作，v1 服务端支持、UI 从简）
```

`call-next(部门)` 语义：原 `interviewing` → `completed`（记结束时间）；该部门 `waiting` 队首 → `interviewing`（记开始时间，callCount+1）；生成一条 `announcement` 广播。

### 4.2 类型

```ts
type Status = 'waiting' | 'interviewing' | 'completed' | 'no_show';

interface Candidate {
  id: string; number: string;         // "A01"
  department: Code;                   // 'A'|'B'|'C'|'D'
  name: string; mobile: string;       // ^1[3-9]\d{9}$
  wechat: string; gradeClass: string; // 年级与专业班级
  status: Status;
  callCount: number; seq: number;
  registeredAt: number;
  interviewStartedAt?: number;        // 大屏显示"面试进行时长"
  interviewEndedAt?: number;
}

interface Announcement {              // 驱动大屏高亮 + TTS
  id: number; type: 'call' | 'recall';
  department: Code; candidateId: string;
  text: string;   // "A02号 钱心雨 同学 请前往 事业部(教210) 参加面试"
  at: number;
}

interface Department { code: Code; name: string; room: string; } // interviewer 名 v1 可空

interface AppState {
  revision: number;
  departments: Department[];
  candidates: Candidate[];
  queueOrder: Record<Code, string[]>;  // 各部门 waiting 的有序 id 数组（置顶/上下移 = 数组换位）
  announcements: Announcement[];       // 保留最近 N=30 条
  counters: Record<Code, number>;      // 部门取号计数器
}
```

## 5. API 清单（Express /api）

| 方法 | 端点 | 说明 |
|---|---|---|
| GET | `/api/health` | 探测用 |
| GET | `/api/state` | 全量快照 + revision |
| POST | `/api/register` | `{department,name,mobile,wechat,gradeClass}` → `{created, candidate, ahead}`；同部门同手机号未完成 → 返回已有 `{created:false}` |
| GET | `/api/lookup?mobile=` | 按手机号查本人全部记录（含实时状态/前方人数） |
| POST | `/api/interviewer/login` | `{password}` → `{token}`（错误不区分提示） |
| POST | `/api/interviewer/call-next` | `{department}` |
| POST | `/api/interviewer/recall` | `{department}` 对当前 interviewing 者再播一次 |
| POST | `/api/interviewer/reorder` | `{department, candidateId, action:'top'|'up'|'down'}` |
| POST | `/api/interviewer/no-show` | `{candidateId}` |

管理端端点校验会话 token（`Authorization: Bearer <token>`，token 存内存/sessionStorage，不落 localStorage 以免被前端偷读）。

## 6. 三视图要点

### 6.1 等候室大屏（`/` 或 `?view=screen`，教208 投影）
- 顶部：当前所在教208 高亮徽章 + 考场横幅（事业部&综务部➜教210 / 信技部&宣传部➜教211）。
- **左侧常驻二维码卡片**：高对比白底大图，内容 = `BASE_URL?view=register`，`qrcode`→DataURL→`<img>` 抗锯齿秒开；`BASE_URL` 取当前窗口 origin（部署时可配）；旁注扫码取号。
- **叫号横幅（最新公告）**：大字显示 text + 语音开关 + 重播按钮（重新 TTS 当前公告）。
- **4 部门看板（4 列，响应式）**：部门卡头（名称+教室）；当前面试中大号高亮显示+进行时长；等待队列按 queueOrder 竖排、队首高亮徽章；已完成 紧凑灰显列表。
- 2s 轮询；新 announcement id → 高亮 + 若语音开启则 TTS（**只在大屏机发声**）。
- 大屏默认显示**脱敏名**（张\*），管理端返回全名给面试官；大屏不做"全显"按钮（v1 从简）——隐私更稳。

### 6.2 手机登记/进度（`?view=register` / `?view=candidate`）
- 步骤一：4 部门卡片（名称/教室/当前等待人数）。
- 步骤二：姓名\*、手机\*（11 位校验）、微信\*、年级专业班级\*。
- 提交后：生成序号 → 凭条卡片（号码大字、部门、教室、前方等待数、实时状态）；前端保存最近凭条，同页可"看我的进度"按手机号自查。
- 同一手机号在同一部门未完成时再次提交 → 不新发号，回显已有凭条。

### 6.3 面试官控制（`?view=interviewer`）
- 密码门（默认 `123`；**页面零提示默认密码**）；会话 sessionStorage；登出。
- 每部门一卡：该部门队列列表（全名），每行：呼叫下一位、再次呼叫；等待者行内置顶/上移/下移。
- 点候选人查看详情（姓名/手机/微信/班级/报名时间/当前状态/叫号次数）。v1 不做打分/编辑。

## 7. 语音（Web Speech API，src/speech/tts.ts 单例）
- 中文发音人优选：`zh-CN` → `zh`，按 voices 列表选含 "Chinese/中文/普通话" 项，取 lang 最长匹配。
- 防重复：同一文本连播去重（2s 内）；支持全局开关 + 重播当前。
- 队列调度：连续公告按序排入队列，speak 完成再播下一条；页面静音/切走暂停不累积爆队列。

## 8. 校验与错误处理
- 前后端双校验：姓名非空、手机 `^1[3-9]\d{9}$`、微信/班级非空、部门合法。
- 前端轮询失败：指数退避静默重试（1s→2s→4s→…上限 10s）；登记冲突/校验失败给明确中文提示；后端不可达自动降级 LocalStore + 顶部细提示条「离线演示模式」。
- JSON 落盘原子写，启动读盘失败时以空状态兜底并告警日志。

## 9. 测试
- 纯逻辑单测（vitest）：状态机 call-next/complete 流转、置顶/上移/下移、防重复取号、部门号码自增、revision 递增。
- API 集成（supertest）：register 冲突、lookup、call-next 端点、auth 拒绝。
- UI 手工验收清单见实现计划。

## 10. 视觉与无障碍（frontend-design 阶段执行）
- 专业考务风：白底 + 深蓝主色 + 每部门一语义色（A 蓝 / B 绿 / C 橙 / D 紫），**无 AI 渐变**。
- 文字对比度满足 WCAG AA；大屏字号大、关键数字超大；桌面 Bento 布局、移动触控区 ≥44px。
