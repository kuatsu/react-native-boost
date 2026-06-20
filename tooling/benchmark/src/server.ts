import { createServer, type IncomingMessage } from 'node:http';
import type { BenchmarkPlan, FpsMeasurement } from './schema.ts';

export interface RunningServer {
  port: number;
  /** Resolves when the app first fetches the plan — the signal that the build finished and it's running. */
  firstContact: Promise<void>;
  /** Resolves with every measurement once the app POSTs `/done`; rejects if the server is closed first. */
  done: Promise<FpsMeasurement[]>;
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
  onMeasure?: (measurement: FpsMeasurement, index: number) => void
): RunningServer {
  const measurements: FpsMeasurement[] = [];
  let resolveDone!: (value: FpsMeasurement[]) => void;
  let rejectDone!: (error: Error) => void;
  const done = new Promise<FpsMeasurement[]>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  let resolveFirstContact!: () => void;
  let rejectFirstContact!: (error: Error) => void;
  const firstContact = new Promise<void>((resolve, reject) => {
    resolveFirstContact = resolve;
    rejectFirstContact = reject;
  });

  const server = createServer((request, response) => {
    const send = (status: number, body: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    if (request.method === 'GET' && request.url === '/plan') {
      resolveFirstContact();
      return send(200, plan);
    }

    if (request.method === 'POST' && request.url === '/measure') {
      readJson<FpsMeasurement>(request)
        .then((measurement) => {
          onMeasure?.(measurement, measurements.length);
          measurements.push(measurement);
          send(200, { ok: true });
        })
        .catch(() => send(400, { ok: false }));
      return;
    }

    if (request.method === 'POST' && request.url === '/done') {
      send(200, { ok: true });
      resolveDone([...measurements]);
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
        rejectDone(new Error('benchmark server closed before the app finished'));
        server.close(() => resolve());
      }),
  };
}
