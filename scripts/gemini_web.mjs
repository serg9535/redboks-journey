// Generate images with Gemini web (Google AI Pro subscription) in the Win10 VM's Chrome via CDP.
// Gemini API has 0 quota without billing (see CLAUDE.md), the web app does not.
//
// Prereqs: Chrome in the VM started with --remote-debugging-port=9222 (scheduled task "ChromeDebug"),
// signed in to Google; SSH tunnel host 9223 -> VM 9222 (see scripts/cdp.mjs); shared folder
// host ../assets/gemini_inbox = VM \\VBoxSvr\gemini_inbox (reference images go to refs/ there).
//
//   node scripts/gemini_web.mjs jobs.json
// jobs.json: [{ "name": "farm_01_dog", "prompt": "...", "refs": ["forest_00.png"] }, ...]
// Results: ../assets/gemini_inbox/out/<name>_<n>.png (every image Gemini returned for the job).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './cdp.mjs';

const INBOX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'gemini_inbox');
const VM_INBOX = '\\\\VBoxSvr\\gemini_inbox';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(c, expr, timeoutMs, stepMs = 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await c.evaluate(expr).catch(() => null);
    if (v) return v;
    await sleep(stepMs);
  }
  throw new Error(`timeout waiting for: ${expr.slice(0, 80)}`);
}

// Gemini sometimes covers the input with a promo/permission card (e.g. "use precise location").
// Always pick the declining option so the batch is not blocked.
const DISMISS = ['Закрыть', 'Нет, спасибо', 'Не сейчас', 'Close', 'No thanks', 'Not now'];
async function dismissPopups(c) {
  await c.evaluate(`(() => {
    const names = ${JSON.stringify(DISMISS)};
    const b = [...document.querySelectorAll('button')].find((x) => names.includes(x.innerText.trim()));
    if (b) b.click();
    return !!b;
  })()`);
}

async function newChat(c) {
  await c.send('Page.navigate', { url: 'https://gemini.google.com/app' });
  await sleep(2000);
  await waitFor(c, `!!document.querySelector('.ql-editor')`, 30000);
  await sleep(1000);
  await dismissPopups(c);
}

async function attach(c, refs) {
  if (!refs?.length) return;
  // the file inputs are only rendered once the "upload & tools" menu has been opened
  await c.evaluate(`document.querySelector('button[aria-label="Загрузка и инструменты"]').click()`);
  await waitFor(c, `!!document.querySelector('input[type=file][accept^="image"]')`, 10000, 300);
  // grab the input before closing the menu: it goes away with it
  const { result } = await c.send('Runtime.evaluate', { expression: `document.querySelector('input[type=file][accept^="image"]')` });
  if (!result.objectId) throw new Error('image file input not found');
  const files = refs.map((r) => `${VM_INBOX}\\refs\\${r}`);
  await c.send('DOM.setFileInputFiles', { files, objectId: result.objectId });
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  // wait until every thumbnail finished uploading (send button enabled again)
  await sleep(1500);
  await waitFor(c, `document.querySelectorAll('uploader-file-preview, .file-preview-container img, [data-test-id=image-preview]').length >= ${refs.length} || document.querySelectorAll('img[src^="blob:"]').length >= ${refs.length}`, 60000);
  await sleep(2000);
}

async function send(c, prompt) {
  await c.evaluate(`document.querySelector('.ql-editor').focus()`);
  await c.send('Input.insertText', { text: prompt });
  await sleep(500);
  await waitFor(c, `(() => { const b = document.querySelector('button[aria-label*="Отправить"]'); return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; })()`, 60000);
  await c.evaluate(`document.querySelector('button[aria-label*="Отправить"]').click()`);
}

// Generated images live in the last model response; uploaded refs are in the user query.
const GEN_IMGS = `[...(document.querySelectorAll('model-response') || [])].pop()?.querySelectorAll('img.image, generated-image img, single-image img') || []`;

// The caption text ("Here is the sprite sheet...") shows up well before the image itself, so
// "text and no image" only counts as a text-only answer after it has stayed that way for a while.
async function waitImages(c, settleMs = 90000) {
  await sleep(5000);
  const t0 = Date.now();
  let textOnlySince = null;
  while (Date.now() - t0 < 300000) {
    const s = await c.evaluate(`(() => {
      const imgs = [...${GEN_IMGS}].filter((i) => i.complete && i.naturalWidth > 200);
      const text = [...document.querySelectorAll('model-response')].pop()?.innerText || '';
      return { imgs: imgs.length, text: text.length, busy: !!document.querySelector('button[aria-label*="Остановить"]') };
    })()`).catch(() => null);
    if (s?.imgs) { await sleep(1500); return s.imgs; }
    if (s && s.text && !s.busy) {
      textOnlySince ??= Date.now();
      if (Date.now() - textOnlySince > settleMs) return -1;
    } else textOnlySince = null;
    await sleep(3000);
  }
  throw new Error('timeout waiting for image');
}

async function download(c, name) {
  const data = await c.evaluate(`(async () => {
    const imgs = [...${GEN_IMGS}].filter((i) => i.naturalWidth > 200);
    const out = [];
    for (const img of imgs) {
      // generated images are blob: URLs (1024 px, plenty for sprites); the page CSP blocks
      // fetch() of them, but a same-origin blob image can be read back through a canvas
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      out.push({ type: 'image/png', b64: cv.toDataURL('image/png').split(',')[1] });
    }
    return out;
  })()`);
  const dir = path.join(INBOX, 'out');
  fs.mkdirSync(dir, { recursive: true });
  return data.map((d, i) => {
    const ext = d.type.includes('png') ? 'png' : d.type.includes('webp') ? 'webp' : 'jpg';
    const f = path.join(dir, `${name}_${i}.${ext}`);
    fs.writeFileSync(f, Buffer.from(d.b64, 'base64'));
    return f;
  });
}

export async function generate(c, job) {
  await newChat(c);
  await attach(c, job.refs);
  await send(c, job.prompt);
  const n = await waitImages(c);
  if (n === -1) {
    const text = await c.evaluate(`[...document.querySelectorAll('model-response')].pop().innerText.slice(0, 300)`);
    return { name: job.name, error: 'no image', text };
  }
  return { name: job.name, files: await download(c, job.name) };
}

if (process.argv[1].endsWith('gemini_web.mjs') && process.argv[2] === '--save-current') {
  // node scripts/gemini_web.mjs --save-current <name>: save images of the last response in the open chat
  const c = await connect();
  try { console.log(JSON.stringify(await download(c, process.argv[3]))); } finally { c.close(); }
} else if (process.argv[1].endsWith('gemini_web.mjs')) {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''));
  const c = await connect();
  await c.send('Page.enable');
  try {
    for (const job of jobs) {
      try { console.log(JSON.stringify(await generate(c, job))); }
      catch (e) { console.log(JSON.stringify({ name: job.name, error: e.message })); }
    }
  } finally { c.close(); }
}
