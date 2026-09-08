import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { ServerStore } from './store';
import { createServerStore, aheadOf } from './store';
import { demoState } from './demo';

const __filename = fileURLToPath(import.meta.url);

interface Options {
  stateFile?: string;
  interviewerPassword?: string;
  seedDemo?: boolean;
}

const SESSIONS = new Set<string>();

export function buildApp(opts: Options = {}) {
  const app = express();
  app.use(express.json());
  const store: ServerStore = createServerStore(opts.stateFile);
  const password = opts.interviewerPassword || process.env.INTERVIEWER_PASSWORD || '123';

  if (opts.seedDemo && store.getState().candidates.length === 0) {
    store.overwrite(demoState());
    console.log('[server] 已播种演示数据（空队列时）');
  }

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

  app.post('/api/interviewer/call', auth, (req, res) => {
    try { const s = store.call(req.body.department, req.body.ids); res.json({ ok: true, revision: s.revision }); }
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

  // 追加一条面试备注（多面试官并发写各自追加，不覆盖）
  app.post('/api/interviewer/comment', auth, (req, res) => {
    try { const s = store.addComment(req.body.candidateId, req.body.text); res.json({ ok: true, revision: s.revision }); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // 设置/清除临时判断：通过 | 不通过 | 待商讨（传 judgment:null 清除）
  app.post('/api/interviewer/judgment', auth, (req, res) => {
    try { const s = store.setJudgment(req.body.candidateId, req.body.judgment ?? null); res.json({ ok: true, revision: s.revision }); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // 删除一条记录（当前队列误录/测试号，或历史归档里需要清除的数据）
  app.post('/api/interviewer/remove', auth, (req, res) => {
    try { const s = store.remove(req.body.candidateId); res.json({ ok: true, revision: s.revision }); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // 面试官补录（现场没扫码的同学）：仅需 部门+姓名+手机号，微信/班级选填
  app.post('/api/interviewer/register', auth, (req, res) => {
    try {
      const c = store.add(req.body);
      res.json({ created: true, candidate: c });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // 开启新一天：归档当天(未完成按已过号)→清空看板→号码重排（前端已二次确认）
  app.post('/api/interviewer/new-session', auth, (req, res) => {
    try {
      const s = store.advanceSession();
      res.json({ ok: true, revision: s.revision, currentSession: s.currentSession });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
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
  const seedDemo = process.env.SEED_DEMO === '1' || process.env.NODE_ENV !== 'production';
  const app = buildApp({ seedDemo });
  app.listen(port, () => console.log(`[server] 面试叫号 API on :${port}`));
}
