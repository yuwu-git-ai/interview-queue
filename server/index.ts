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

  // 面试官补录（现场没扫码的同学）：仅需 部门+姓名+手机号，微信/班级选填
  app.post('/api/interviewer/register', auth, (req, res) => {
    try {
      const c = store.add(req.body);
      res.json({ created: true, candidate: c });
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
