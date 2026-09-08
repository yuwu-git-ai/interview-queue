// 零依赖 .xlsx 生成器：手工构造最小 OOXML + 无压缩(zip store) 打包。
// 生成的表格 Excel/WPS 可直接打开：首行加粗、自动列宽、所有单元格按文本写入（避免手机号变科学计数）。

function xmlEsc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colName(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/* ---------- ZIP (store, no compression) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function le16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function le32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

function makeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: number[] = [];
  const central: number[] = [];
  const enc = new TextEncoder();

  files.forEach((f) => {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const offset = chunks.length;
    // local file header
    chunks.push(
      ...le32(0x04034b50), // PK\x03\x04
      ...le16(20), // version
      ...le16(0), // flags
      ...le16(0), // method: store
      ...le16(0), // mod time
      ...le16(0), // mod date
      ...le32(crc),
      ...le32(size),
      ...le32(size),
      ...le16(name.length),
      ...le16(0) // extra len
    );
    chunks.push(...name);
    chunks.push(...f.data);
    // central directory header
    central.push(
      ...le32(0x02014b50), // PK\x01\x02
      ...le16(20), // version made by
      ...le16(20), // version needed
      ...le16(0), // flags
      ...le16(0), // method: store
      ...le16(0), // mod time
      ...le16(0), // mod date
      ...le32(crc),
      ...le32(size),
      ...le32(size),
      ...le16(name.length),
      ...le16(0), // extra len
      ...le16(0), // comment len
      ...le16(0), // disk start
      ...le16(0), // internal attrs
      ...le32(0), // external attrs
      ...le32(offset)
    );
    central.push(...name);
  });

  const cdSize = central.length;
  const cdOffset = chunks.length;
  chunks.push(...central);
  chunks.push(
    ...le32(0x06054b50), // end of central dir
    ...le16(0),
    ...le16(0),
    ...le16(files.length),
    ...le16(files.length),
    ...le32(cdSize),
    ...le32(cdOffset),
    ...le16(0)
  );
  return new Uint8Array(chunks);
}

/* ---------- XLSX XML ---------- */
function sheetXml(sheetName: string, header: string[], rows: string[][]): string {
  const maxLen = (arr: string[]) => arr.reduce((m, s) => Math.max(m, String(s).length), 0);
  const widths = header.map((_, i) => Math.max(8, Math.min(32, maxLen([header[i], ...rows.map((r) => r[i] ?? '')]) + 2)));
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}"/>`).join('')}</cols>`;
  const cell = (c: number, v: string, r: number, headerCell: boolean) =>
    headerCell
      ? `<c r="${colName(c)}${r}" t="inlineStr" s="1"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`
      : `<c r="${colName(c)}${r}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;

  const headRow = `<row r="1">${header.map((h, c) => cell(c, h, 1, true)).join('')}</row>`;
  const dataRows = rows
    .map((r, ri) => {
      const rowNum = ri + 2;
      return `<row r="${rowNum}">${header.map((_, ci) => cell(ci, r[ci] ?? '', rowNum, false)).join('')}</row>`;
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    cols +
    `<sheetData>${headRow}${dataRows}</sheetData>` +
    `</worksheet>`
  );
}

/** 生成 .xlsx Blob（首行加粗；全部按文本单元格写入） */
export function buildXlsx(sheetName: string, header: string[], rows: string[][]): Blob {
  const enc = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [];
  const push = (name: string, xml: string) => files.push({ name, data: enc.encode(xml) });

  push('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);

  push('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  push('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlEsc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);

  push('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  push('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);

  push('xl/worksheets/sheet1.xml', sheetXml(sheetName, header, rows));

  return new Blob([makeZip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
