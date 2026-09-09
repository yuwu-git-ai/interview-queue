# 面试排队叫号系统

面向校园/社团多部门面试的轻量排队叫号 Web 应用。三大视图经 `?view=` 切换，多屏/多设备数据一致。

## 视图入口

| 视图 | URL | 用途 |
|---|---|---|
| 等候室大屏 | `/` 或 `/?view=screen` | 教208 投影：常驻二维码 + 4 部门看板（面试中/等待/已完成）+ 叫号高亮与语音播报 |
| 手机登记 | `/?view=register` | 扫码选部门 → 填 姓名/手机/微信/班级 → 自动出号 → 凭条与进度自查 |
| 面试官控制台 | `/?view=interviewer` | 密码登录 → 呼叫下一位 / 再次呼叫 / 置顶·上移·下移 / 查看候选人详情 |

## 考场配置

| 部门 | 教室 | 排号前缀 |
|---|---|---|
| 事业部 (A) | 教214 | A01… |
| 综务部 (B) | 教210 | B01… |
| 信技部 (C) | 教211 | C01… |
| 宣传部 (D) | 教211 | D01… |

等候室：教208。

## 快速开始

```bash
npm install
npm run dev:all        # 前端 :3000 + 后端 :3001（vite 代理 /api）
```

打开 `http://localhost:3000/?view=screen`。三个视图各开一个标签即可联调。

**面试官登录密码**：默认 `123`（UI 不做任何提示）。用环境变量 `INTERVIEWER_PASSWORD` 覆盖。

## 生产运行（单进程）

```bash
npm run build
SEED_DEMO=1 npm start  # Express 托管 dist/ + API，默认 :3001，端口用 PORT 改
```

- `SEED_DEMO=1`：仅当状态为空时播种演示数据（方便演示看板），正式使用不设或设 `0` 从空队列起跑。
- 局域网手机扫码：让手机连同一局域网，用电脑局域网 IP 访问（如 `http://192.168.x.x:3001/`），二维码自动指向当前访问地址。

## 数据与降级

- 后端把状态持久化到 `data/state.json`（原子写入）；多设备经 REST 2s 轮询同步。
- 若后端不可达，前端自动降级为 `localStorage` + BroadcastChannel 的本地演示模式（顶部黄条提示），同机多标签可联动。

## 状态流转

```
扫码登记 → 等待(waiting) → 面试官"呼叫下一位" → 面试中(interviewing) → 再次呼叫/完成 → 已完成(completed)
```

同一手机号在同一部门**未完成**前重复登记会自动找回原凭条（不重复发号）。

## 语音播报规则

- 声音**只**在等候室大屏这台机器发出，且**仅**在面试官点击「呼叫下一位/再次呼叫」产生新公告后播放。
- 新登记、刷新页面、普通轮询**不**触发语音。
- 大屏右上角可开关语音 / 手动重播。

## 技术栈与结构

React 19 · Vite 6 · TypeScript · Tailwind CSS v4 · Express · JSON 持久化 · Web Speech API · qrcode

```
shared/   # 前后端复用：types / constants / 纯状态机 engine
server/   # Express API + store(JSON 落盘) + demo 播种
src/      # 前端：lib(store/qrcode/tts) + components + views(三视图)
tests/    # vitest 单测 + supertest 集成测
```

## 测试

```bash
npm test       # 28 用例：状态机流转 / 防重复 / JSON 持久化 / API 集成
npx tsc --noEmit
```

## 后续可加（v2）
姓名脱敏切换、播报历史抽屉、评分/录用淘汰 UI、候选人编辑与手动录入、部门教室/面试官维护界面、一键清空队列/重置。
