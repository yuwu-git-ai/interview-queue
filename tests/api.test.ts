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
    const res = await request(app).post('/api/interviewer/call-next').send({ department: 'A' });
    expect(res.status).toBe(401);
  });
  it('登录(123)后 call-next 可用且 revision 增加、产生公告', async () => {
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
  it('GET /api/lookup 按手机号查询', async () => {
    await request(app).post('/api/register').send({ department: 'C', name: '查小明', mobile: '13800000999', wechat: 'wxq', gradeClass: '计科2201' });
    const res = await request(app).get('/api/lookup').query({ mobile: '13800000999' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].number).toBe('C01');
    expect(res.body[0].ahead).toBe(0);
  });
});
