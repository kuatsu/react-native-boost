import { createServer, type IncomingMessage } from 'node:http';
import type { BenchmarkPlan, FpsSample } from './schema.ts';

/** What the app reports on first contact — its baked profile flags, for the staleness handshake. */
export interface FirstContact {
  /** The RN flags the running bundle echoes (the `flags` query param on `GET /plan`). */
  flags: string;
}

export interface RunningServer {
  port: number;
  /** Resolves when the app first fetches the plan — the signal that the build finished and it's running.
   *  Carries the bundle's echoed flags so the collector can reject a stale build (wrong profile). */
  firstContact: Promise<FirstContact>;
  /** Resolves with every sample once the app POSTs `/done`; rejects if the server is closed first. */
  done: Promise<FpsSample[]>;
  /** Resolves once the socket is fully released. */
  close: () => Promise<void>;
}

function readJson<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch (error) {
        reject(error as Error);
      }
    });
    request.on('error', reject);
  });
}

/**
 * The control-plane the self-driving app talks to: serves the sweep plan (`GET /plan`), collects each
 * captured config (`POST /measure`), and completes when the app reports `POST /done`. Bound to 0.0.0.0
 * so a simulator (localhost), emulator (10.0.2.2), or physical device (LAN IP) can all reach it.
 */
export function startServer(
  plan: BenchmarkPlan,
  port: number,
  onMeasure?: (sample: FpsSample, index: number) => void
): RunningServer {
  const samples: FpsSample[] = [];
  let resolveDone!: (value: FpsSample[]) => void;
  let rejectDone!: (error: Error) => void;
  const done = new Promise<FpsSample[]>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  let resolveFirstContact!: (value: FirstContact) => void;
  let rejectFirstContact!: (error: Error) => void;
  const firstContact = new Promise<FirstContact>((resolve, reject) => {
    resolveFirstContact = resolve;
    rejectFirstContact = reject;
  });

  const server = createServer((request, response) => {
    const send = (status: number, body: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/plan') {
      resolveFirstContact({ flags: url.searchParams.get('flags') ?? '' });
      return send(200, plan);
    }

    if (request.method === 'POST' && url.pathname === '/measure') {
      readJson<FpsSample>(request)
        .then((sample) => {
          onMeasure?.(sample, samples.length);
          samples.push(sample);
          send(200, { ok: true });
        })
        .catch(() => send(400, { ok: false }));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/done') {
      send(200, { ok: true });
      resolveDone([...samples]);
      return;
    }

    send(404, { ok: false });
  });

  // Surface a failed bind (e.g. port already in use) as a rejection instead of an uncaught 'error' crash.
  server.on('error', (error) => {
    rejectFirstContact(error);
    rejectDone(error);
  });
  server.listen(port, '0.0.0.0');

  return {
    port,
    firstContact,
    done,
    // Awaitable so a sequential run can't re-bind the port before this socket is fully released.
    close: () =>
      new Promise<void>((resolve) => {
        // Reject both pending promises so a caller awaiting either (e.g. firstContact before any GET /plan)
        // can't hang past close; a settled promise ignores the extra reject.
        const error = new Error('benchmark server closed before the app finished');
        rejectFirstContact(error);
        rejectDone(error);
        server.close(() => resolve());
      }),
  };
}
