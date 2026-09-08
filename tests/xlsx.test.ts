import { describe, it, expect } from 'vitest';
import { buildXlsx } from '@/src/lib/xlsx';

describe('xlsx 导出器', () => {
  it('生成合法 zip(store) 字节：PK 头 + 必要部件名 + 内容可见', async () => {
    const blob = buildXlsx('名单汇总', ['号码', '姓名'], [
      ['A01', '张三'],
      ['A02', '李四'],
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const head = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    expect(head).toBe('PK'); // PK\x03\x04 (local header)
    const text = new TextDecoder().decode(buf);
    expect(text).toContain('[Content_Types].xml');
    expect(text).toContain('xl/workbook.xml');
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('A01');
    expect(text).toContain('张三');
    // 表头第一格应为加粗样式 s="1"
    expect(text).toContain('t="inlineStr" s="1"');
  });
});
