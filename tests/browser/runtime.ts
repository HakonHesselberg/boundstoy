import { extname, isAbsolute, resolve, sep } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export type Options = { browser: string; timeout: number };

export function parseOptions(args: string[]): Options {
  const options = { browser: '/usr/bin/chromium', timeout: 90_000 };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--browser', '--timeout'].includes(flag) || seen.has(flag)) throw new Error(`Unknown or duplicate argument: ${flag}`);
    seen.add(flag);
    if (flag === '--browser') {
      if (!value || !isAbsolute(value)) throw new Error('--browser needs an absolute path to an installed Chromium executable.');
      options.browser = value;
    } else {
      if (!value || !/^\d+$/.test(value) || Number(value) < 100 || Number(value) > 600_000) {
        throw new Error('--timeout needs an integer from 100 to 600000 milliseconds.');
      }
      options.timeout = Number(value);
    }
  }
  return options;
}

export function chromiumArgs(profile: string): string[] {
  return [
    '--headless=new', '--enable-automation', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update', '--disable-sync',
    '--metrics-recording-only', '--password-store=basic', '--use-mock-keychain',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,900',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
  ];
}

export function chromiumEnvironment(profile: string): NodeJS.ProcessEnv {
  return {
    ...process.env, HOME: profile, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: profile,
    XDG_DATA_HOME: profile, TMPDIR: profile, CHROME_CONFIG_HOME: profile,
    CHROME_USER_DATA_DIR: profile, CHROMIUM_FLAGS: '', CHROME_FLAGS: '',
  };
}

export class Cleanup {
  private disposers: (() => Promise<void>)[] = [];
  add(dispose: () => Promise<void>) { this.disposers.push(dispose); }
  async close() {
    const errors: unknown[] = [];
    for (const dispose of this.disposers.splice(0).reverse()) {
      try { await dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new Error(`Cleanup failed: ${errors.map(String).join('; ')}`);
  }
}

export async function waitFor<T>(label: string, probe: () => Promise<T | null | false | undefined>,
  timeout = 5000, signal?: AbortSignal): Promise<T> {
  const deadline = Date.now() + timeout;
  do {
    signal?.throwIfAborted();
    const result = await probe();
    if (result !== null && result !== false && result !== undefined) return result;
    await delay(Math.min(25, Math.max(1, deadline - Date.now())), undefined, { signal }).catch(error => {
      signal?.throwIfAborted();
      throw error;
    });
  } while (Date.now() < deadline);
  throw new Error(`${label} timed out after ${timeout}ms.`);
}

export async function stopChild(child: ChildProcess, grace = 3000, group = false) {
  if (!child.pid) return;
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  const stopped = () => {
    if (!group) return exited();
    try { process.kill(-child.pid!, 0); return false; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return exited(); throw error; }
  };
  const kill = (signal: NodeJS.Signals) => {
    if (!group) { child.kill(signal); return; }
    try { process.kill(-child.pid!, signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  if (stopped()) return;
  kill('SIGTERM');
  try {
    await waitFor('Owned process/group termination', async () => stopped(), grace);
  } catch {
    kill('SIGKILL');
    await waitFor('Owned process/group forced termination', async () => stopped(), 2000);
  }
}

// Avoid Vite preview's process-exiting SIGTERM handler: this listener belongs only to the runner.
export async function startPreview(directory: string, cleanup: Cleanup, signal?: AbortSignal): Promise<string> {
  const root = await realpath(directory);
  const types: Record<string, string> = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  };
  const server = createServer((request, response) => {
    const serve = async () => {
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
      let pathname: string;
      try { pathname = decodeURIComponent(new URL(request.url!, 'http://127.0.0.1').pathname); }
      catch { response.writeHead(400).end(); return; }
      const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      try {
        const actual = await realpath(path);
        if (!actual.startsWith(root + sep)) { response.writeHead(403).end(); return; }
        const body = await readFile(actual);
        response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : body);
      } catch (error) {
        response.writeHead(['ENOENT', 'EISDIR'].includes((error as NodeJS.ErrnoException).code ?? '') ? 404 : 500).end();
      }
    };
    void serve().catch(() => response.destroy());
  });
  cleanup.add(async () => {
    const closed = new Promise<void>((done, reject) => server.close(error =>
      error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : done()));
    server.closeAllConnections();
    await closed;
  });
  let startupError: Error | undefined;
  server.on('error', error => { startupError = error; });
  server.listen(0, '127.0.0.1');
  await waitFor('Loopback production server startup', async () => {
    if (startupError) throw startupError;
    return server.listening;
  }, 5000, signal);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Production server did not bind a TCP port.');
  return `http://127.0.0.1:${address.port}`;
}

type Pending = {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type EventParams = Record<string, any>;

// Private CDP transport: one owned page, no session multiplexing or browser discovery.
export class Cdp {
  private socket: WebSocket;
  private timeout: number;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  private listeners = new Map<string, ((params: EventParams) => void)[]>();
  private closed = false;

  constructor(socket: WebSocket, timeout = 5000) {
    this.socket = socket; this.timeout = timeout;
    socket.addEventListener('message', event => {
      try {
        const message = JSON.parse(String(event.data));
        if (!message || typeof message !== 'object') throw new Error('Expected CDP object');
        if ('id' in message) {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          this.pending.delete(message.id); clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(`${pending.method}: ${JSON.stringify(message.error)}`));
          else if ('result' in message) pending.resolve(message.result);
          else pending.reject(new Error(`${pending.method}: malformed CDP reply (missing result).`));
        } else if (typeof message.method === 'string') {
          for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
        } else throw new Error('Expected CDP event or reply');
      } catch (error) { this.close(new Error(`Malformed CDP message: ${String(error)}`)); }
    });
    socket.addEventListener('close', () => this.close(new Error('CDP socket closed. Chromium may have exited.')));
    socket.addEventListener('error', () => this.close(new Error('CDP socket error. Check chromium.log.')));
  }

  static async connect(url: string, timeout = 5000, signal?: AbortSignal): Promise<Cdp> {
    const address = new URL(url);
    if (address.protocol !== 'ws:' || address.hostname !== '127.0.0.1') throw new Error(`Refusing non-loopback CDP endpoint: ${url}`);
    const socket = new WebSocket(url);
    const cdp = new Cdp(socket, timeout);
    try {
      await waitFor('CDP WebSocket connection', async () => {
        if (cdp.closed) throw new Error('CDP WebSocket closed before opening.');
        return socket.readyState === WebSocket.OPEN;
      }, timeout, signal);
      return cdp;
    } catch (error) { cdp.close(); throw error; }
  }

  on(method: string, listener: (params: EventParams) => void) {
    this.listeners.set(method, [...this.listeners.get(method) ?? [], listener]);
  }

  call<T = Record<string, unknown>>(method: string, params: object = {}): Promise<T> {
    if (this.closed) return Promise.reject(new Error(`${method}: CDP socket is closed.`));
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${this.timeout}ms.`));
      }, this.timeout);
      this.pending.set(id, { method, resolve: value => resolve(value as T), reject, timer });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) { this.close(new Error(`${method}: ${String(error)}`)); }
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const reply = await this.call<{
      result: { value: T };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }).catch(error => {
      throw new Error(`${String(error)}\nExpression: ${expression.slice(0, 240)}`, { cause: error });
    });
    if (reply.exceptionDetails) throw new Error(`Browser evaluation failed: ${
      reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text}`);
    return reply.result.value;
  }

  close(reason = new Error('CDP socket closed by runner.')) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(reason); }
    this.pending.clear(); this.listeners.clear(); this.socket.close();
  }
}
