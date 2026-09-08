import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '@/server/index';
import fs from 'node:fs';

const STATE = process.cwd() + '/.tmp-api-test.json';
let app: ReturnType<typeof buildApp>;

beforeAll(() => {
  fs.rmSync(STATE, { force: true });
  app = buildApp({ stateFile: STATE });
});
afterAll(() => fs.rmSync(STATE, { force: true }));

describe('API', () => {
  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  it('POST /api/register 成功 → created/candidate', async () => {
    const res = await request(app).post('/api/register').send({
      department: 'A', name: '钱心雨', mobile: '13800000001', wechat: 'wx1', gradeClass: '计科2201',
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(true);
    expect(res.body.candidate.number).toBe('A01');
    expect(res.body.ahead).toBe(0);
  });
  it('同手机号同部门重复 → created:false 找回', async () => {
    await request(app).post('/api/register').send({ department: 'A', name: '钱心雨', mobile: '13800000001', wechat: 'wx1', gradeClass: '计科2201' });
    const dup = await request(app).post('/api/register').send({ department: 'A', name: '重复', mobile: '13800000001', wechat: 'wx2', gradeClass: '计科2202' });
    expect(dup.body.created).toBe(false);
    expect(dup.body.candidate.name).toBe('钱心雨');
  });
  it('未登录访问面试官端点 → 401', async () => {
    const res = await request(app).post('/api/interviewer/call').send({ department: 'A', ids: [] });
    expect(res.status).toBe(401);
  });
  it('登录(123)后选人叫号可用且 revision 增加、产生公告', async () => {
    const login = await request(app).post('/api/interviewer/login').send({ password: '123' });
    const token = login.body.token;
    const st = (await request(app).get('/api/state')).body;
    const aId = st.candidates.find((c: any) => c.department === 'A' && c.status === 'waiting')?.id;
    expect(aId).toBeTruthy();
    const before = st.revision;
    const call = await request(app)
      .post('/api/interviewer/call')
      .send({ department: 'A', ids: [aId] })
      .set('Authorization', `Bearer ${token}`);
    expect(call.status).toBe(200);
    const after = (await request(app).get('/api/state')).body.revision;
    expect(after).toBeGreaterThan(before);
    expect((await request(app).get('/api/state')).body.announcements.length).toBeGreaterThan(0);
  });
  it('错误密码登录 → 401', async () => {
    const res = await request(app).post('/api/interviewer/login').send({ password: 'bad' });
    expect(res.status).toBe(401);
  });
  it('GET /api/lookup 按手机号查询', async () => {
    await request(app).post('/api/register').send({ department: 'C', name: '查小明', mobile: '13800000999', wechat: 'wxq', gradeClass: '计科2201' });
    const res = await request(app).get('/api/lookup').query({ mobile: '13800000999' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].number).toBe('C01');
    expect(res.body[0].ahead).toBe(0);
  });
  it('未登录访问补录端点 → 401', async () => {
    const res = await request(app).post('/api/interviewer/register').send({ department: 'B', name: '某人', mobile: '13800008888' });
    expect(res.status).toBe(401);
  });
  it('登录后补录（仅姓名+手机号）→ 新号 B01，微信/班级为空可接受', async () => {
    const login = await request(app).post('/api/interviewer/login').send({ password: '123' });
    const token = login.body.token;
    const res = await request(app)
      .post('/api/interviewer/register')
      .send({ department: 'B', name: '补录同学', mobile: '13800008888' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(true);
    expect(res.body.candidate.number).toBe('B01');
    expect(res.body.candidate.wechat).toBe('');
    expect(res.body.candidate.gradeClass).toBe('');
  });
  it('同部门同手机号补录重复 → 400 提示已有登记', async () => {
    const login = await request(app).post('/api/interviewer/login').send({ password: '123' });
    const token = login.body.token;
    const dup = await request(app)
      .post('/api/interviewer/register')
      .send({ department: 'B', name: '补录同学2', mobile: '13800008888' })
      .set('Authorization', `Bearer ${token}`);
    expect(dup.status).toBe(400);
    expect(dup.body.error).toContain('已有登记');
  });
  it('登录后追加备注 + 设/清临时判断', async () => {
    const login = await request(app).post('/api/interviewer/login').send({ password: '123' });
    const token = login.body.token;
    const id = (await request(app).get('/api/state')).body.candidates[0].id;
    const c1 = await request(app).post('/api/interviewer/comment').send({ candidateId: id, text: '沟通流畅' }).set('Authorization', `Bearer ${token}`);
    expect(c1.status).toBe(200);
    const st1 = (await request(app).get('/api/state')).body.candidates.find((c: any) => c.id === id);
    expect(st1.comments.length).toBe(1);
    const j1 = await request(app).post('/api/interviewer/judgment').send({ candidateId: id, judgment: 'pass' }).set('Authorization', `Bearer ${token}`);
    expect(j1.status).toBe(200);
    expect((await request(app).get('/api/state')).body.candidates.find((c: any) => c.id === id).judgment).toBe('pass');
    const j2 = await request(app).post('/api/interviewer/judgment').send({ candidateId: id, judgment: null }).set('Authorization', `Bearer ${token}`);
    expect(j2.status).toBe(200);
    expect((await request(app).get('/api/state')).body.candidates.find((c: any) => c.id === id).judgment).toBeUndefined();
  });
  it('未登录备注 → 401', async () => {
    const r = await request(app).post('/api/interviewer/comment').send({ candidateId: 'x', text: 'hi' });
    expect(r.status).toBe(401);
  });
  it('登录后删除记录（当前队列）→ revision 增加', async () => {
    const login = await request(app).post('/api/interviewer/login').send({ password: '123' });
    const token = login.body.token;
    const st = (await request(app).get('/api/state')).body;
    const id = st.candidates[0].id;
    const before = st.revision;
    const r = await request(app).post('/api/interviewer/remove').send({ candidateId: id }).set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect((await request(app).get('/api/state')).body.revision).toBeGreaterThan(before);
  });
  it('未登录删除 → 401', async () => {
    const r = await request(app).post('/api/interviewer/remove').send({ candidateId: 'x' });
    expect(r.status).toBe(401);
  });
  it('未登录开启新一天 → 401', async () => {
    const res = await request(app).post('/api/interviewer/new-session').send({});
    expect(res.status).toBe(401);
  });
  it('登录后开启新一天 → 全部归档、看板清空、场次+1', async () => {
    const before = (await request(app).get('/api/state')).body;
    const login = await request(app).post('/api/interviewer/login').send({ password: '123' });
    const token = login.body.token;
    const res = await request(app).post('/api/interviewer/new-session').send({}).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const after = (await request(app).get('/api/state')).body;
    expect(after.currentSession).toBe(before.currentSession + 1);
    expect(after.candidates.length).toBe(0);
    expect(after.archive.length).toBe(before.candidates.length);
  });
});
