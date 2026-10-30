// Minimal Chrome DevTools Protocol client for driving Chrome in the Win10 VM
// (Gemini web) from the host. Needs the SSH tunnel: host 127.0.0.1:9223 -> VM 127.0.0.1:9222.
//
//   node scripts/cdp.mjs eval "<js expression>"   # prints JSON result (awaits promises)
//   node scripts/cdp.mjs evalfile <file.js>       # same, expression read from a file
//   node scripts/cdp.mjs shot <out.png>           # screenshot of the page viewport
//   node scripts/cdp.mjs nav <url>
//
// Target page: first "page" whose URL matches CDP_MATCH (default "gemini.google.com").
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || 9223;
const MATCH = process.env.CDP_MATCH || 'gemini.google.com';

export async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page' && t.url.includes(MATCH)) || list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  return { send, evaluate, close: () => ws.close(), page };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('cdp.mjs')) {
  const [cmd, arg] = process.argv.slice(2);
  const c = await connect();
  try {
    if (cmd === 'eval') console.log(JSON.stringify(await c.evaluate(arg), null, 1));
    else if (cmd === 'evalfile') console.log(JSON.stringify(await c.evaluate(fs.readFileSync(arg, 'utf8')), null, 1));
    else if (cmd === 'shot') {
      const r = await c.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(arg, Buffer.from(r.data, 'base64'));
      console.log('saved', arg);
    } else if (cmd === 'nav') { await c.send('Page.navigate', { url: arg }); console.log('ok'); }
    else console.log('usage: eval|evalfile|shot|nav');
  } finally { c.close(); }
}
