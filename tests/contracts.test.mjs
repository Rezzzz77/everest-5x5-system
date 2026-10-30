import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dirname);
const HTML_PATH = path.join(ROOT, 'index.html');
const APP_PATH = path.join(ROOT, 'app.js');

test('قرارداد HTML ↔ JS: تمام توابع فراخوانی‌شده به window متصل هستند', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const app = fs.readFileSync(APP_PATH, 'utf8');

  const handlerRegex = /on(?:click|change|input)="([A-Za-z_$][\w$]*)\s*\(/g;
  const handlers = new Set();
  let m;
  while ((m = handlerRegex.exec(html)) !== null) handlers.add(m[1]);
  while ((m = handlerRegex.exec(app)) !== null) handlers.add(m[1]);

  const blockMatch = app.match(/Object\.assign\(window,\s*\{([\s\S]*?)\}\s*\)/);
  assert.ok(blockMatch, 'بلوک Object.assign(window, {...}) در app.js یافت نشد');

  const exposedRegex = /[A-Za-z_$][\w$]*/g;
  const exposed = new Set();
  while ((m = exposedRegex.exec(blockMatch[1])) !== null) exposed.add(m[0]);

  const missing = [...handlers].filter(fn => !exposed.has(fn));
  assert.deepEqual(missing, [], `این توابع در HTML فراخوانی شده‌اند ولی به window متصل نیستند: ${missing.join(', ')}`);
});

test('قرارداد DOM: تمام شناسه‌های استفاده‌شده در JS در HTML وجود دارند', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const app = fs.readFileSync(APP_PATH, 'utf8');

  const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
  const usedIds = new Set();
  let m;
  while ((m = idRegex.exec(app)) !== null) usedIds.add(m[1]);

  const htmlIdRegex = /id="([^"]+)"/g;
  const htmlIds = new Set();
  while ((m = htmlIdRegex.exec(html)) !== null) htmlIds.add(m[1]);

  const missing = [...usedIds].filter(id => !htmlIds.has(id));
  assert.deepEqual(missing, [], `این شناسه‌ها در app.js خوانده شده‌اند ولی در index.html نیستند: ${missing.join(', ')}`);
});

test('قرارداد ماژول‌ها: تمام فایل‌های import شده وجود دارند', () => {
  const app = fs.readFileSync(APP_PATH, 'utf8');
  const importRegex = /from\s+'(\.\/[^']+)'/g;
  let m;
  while ((m = importRegex.exec(app)) !== null) {
    const fullPath = path.join(ROOT, m[1]);
    assert.ok(fs.existsSync(fullPath), `ماژول ${m[1]} پیدا نشد.`);
  }
});
