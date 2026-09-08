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
  it('初始为空状态', () => {
    expect(store.getState().candidates.length).toBe(0);
  });
  it('register 后写入文件；重启读回同一状态', () => {
    const r = store.register({ department: 'A', name: '钱心雨', mobile: '13800000001', wechat: 'wx', gradeClass: '计科2201', note: '' });
    expect(r.created).toBe(true);
    expect(r.candidate.number).toBe('A01');
    const store2 = createServerStore(TMP);
    expect(store2.getState().candidates.length).toBe(1);
    expect(store2.getState().candidates[0].name).toBe('钱心雨');
  });
  it('revision 单调递增', () => {
    const r0 = store.getState().revision;
    const r = store.register({ department: 'B', name: 'x', mobile: '13800000002', wechat: 'w', gradeClass: 'c', note: '' });
    store.call('B', [r.candidate.id]);
    expect(store.getState().revision).toBeGreaterThan(r0);
  });
  it('overwrite 替换并落盘', () => {
    store.overwrite(store.getState());
    expect(fs.existsSync(TMP)).toBe(true);
  });
  it('密码校验', () => {
    expect(store.verifyPassword('123')).toBe(true);
    expect(store.verifyPassword('wrong')).toBe(false);
  });
});
