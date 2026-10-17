import http from 'node:http';
import https from 'node:https';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const fingerprint = key => createHash('sha256').update(key).digest('hex');

function headersWithoutHopHeaders(headers) {
  const excluded = new Set([...hopHeaders, ...String(headers.connection ?? '')
    .split(',').map(value => value.trim().toLowerCase())]);
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !excluded.has(key)));
}

function authorized(headers, token) {
  const value = headers['x-api-key'] ?? String(headers.authorization ?? '').replace(/^Bearer /i, '');
  if (typeof value !== 'string') return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createKeyRouter({ primaryKey, fallbackKey, token, stateFile,
  upstream = 'https://api.deepseek.com', idleTimeoutMs = 300000,
  maxBodyBytes = 256 * 1024 * 1024, log = () => {} }) {
  if (!primaryKey || !fallbackKey || !token) throw new Error('Both upstream keys and the local token are required');
  const primaryHash = fingerprint(primaryKey);
  let exhausted = false;
  if (stateFile && existsSync(stateFile)) {
    exhausted = JSON.parse(readFileSync(stateFile, 'utf8')).exhaustedPrimary === primaryHash;
  }
  function markExhausted() {
    if (exhausted) return;
    if (stateFile) {
      mkdirSync(dirname(stateFile), { recursive: true, mode: 0o700 });
      const temporary = stateFile + '.tmp';
      writeFileSync(temporary, JSON.stringify({ exhaustedPrimary: primaryHash }) + '\n', { mode: 0o600 });
      renameSync(temporary, stateFile);
    }
    exhausted = true;
    log('primary balance exhausted; switching to fallback');
  }

  const server = http.createServer(async (request, response) => {
    const fail = (status, message) => {
      if (response.headersSent) return response.destroy();
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { type: 'key_router_error', message } }));
    };
    if (request.method === 'GET' && request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json' });
      return response.end(JSON.stringify({ active: exhausted ? 'fallback' : 'primary' }));
    }
    if (!authorized(request.headers, token)) return fail(401, 'Invalid local credential');
    if (!request.url.startsWith('/') || request.url.startsWith('//')) return fail(400, 'Invalid request path');
    const target = new URL(request.url, upstream);
    if (target.origin !== new URL(upstream).origin) return fail(400, 'Invalid request origin');
    const controller = new AbortController();
    response.on('close', () => controller.abort());
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > maxBodyBytes) return fail(413, 'Request exceeds the configured body limit');
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const attempt = key => new Promise((accept, reject) => {
        const headers = headersWithoutHopHeaders(request.headers);
        delete headers.host;
        delete headers.authorization;
        delete headers['x-api-key'];
        delete headers.expect;
        headers['content-length'] = String(body.length);
        if (target.pathname.startsWith('/anthropic/')) headers['x-api-key'] = key;
        else headers.authorization = 'Bearer ' + key;
        const transport = target.protocol === 'https:' ? https : http;
        const outgoing = transport.request(target, {
          method: request.method, headers, signal: controller.signal,
        }, accept);
        outgoing.on('error', reject);
        outgoing.setTimeout(idleTimeoutMs, () => outgoing.destroy(new Error('Upstream idle timeout')));
        outgoing.end(body);
      });
      const usePrimary = !exhausted;
      let result = await attempt(usePrimary ? primaryKey : fallbackKey);
      // Retry only an HTTP 402, before any upstream bytes reach the caller.
      // Streaming failures, rate limits, invalid keys and server failures never swap keys.
      if (usePrimary && result.statusCode === 402) {
        result.resume();
        markExhausted();
        result = await attempt(fallbackKey);
      }
      response.writeHead(result.statusCode, headersWithoutHopHeaders(result.headers));
      result.on('error', () => response.destroy());
      result.pipe(response);
    } catch {
      if (!controller.signal.aborted) fail(502, 'Upstream request failed');
    }
  });
  return server;
}

async function main() {
  const env = process.env;
  const server = createKeyRouter({
    primaryKey: env.DEEPSEEK_PRIMARY_API_KEY,
    fallbackKey: env.DEEPSEEK_FALLBACK_API_KEY,
    token: env.DEEPSEEK_API_KEY,
    stateFile: resolve(env.DSH_HOME ?? '/home/vscode/.dsh', 'key-router-state.json'),
    log: message => console.log('DeepSeek key router: ' + message),
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(18080, '127.0.0.1', accept);
  });
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error('A harness command is required');
  const childEnvironment = { ...env };
  delete childEnvironment.DEEPSEEK_PRIMARY_API_KEY;
  delete childEnvironment.DEEPSEEK_FALLBACK_API_KEY;
  const child = spawn(command, args, { env: childEnvironment, stdio: 'inherit' });
  const stop = signal => {
    child.kill(signal);
    server.closeAllConnections();
    server.close();
    setTimeout(() => child.kill('SIGKILL'), 10000).unref();
  };
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop(signal));
  child.on('error', () => {
    console.error('DeepSeek key router: harness could not start');
    server.closeAllConnections();
    server.close(() => process.exit(1));
  });
  child.on('exit', (code, signal) => {
    server.closeAllConnections();
    server.close(() => process.exit(code ?? (signal === 'SIGTERM' ? 0 : 1)));
  });
  server.on('error', () => stop('SIGTERM'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('DeepSeek key router: startup failed'); process.exit(1); });
}
