import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const output = resolve(process.argv[2] ?? 'benchmarks/view-context.json');
const plan = { loads: [500, 2000], replicates: 13 };
const samples = [];
const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/plan') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(plan));
    return;
  }
  let body = '';
  for await (const chunk of request) body += chunk;
  if (request.method === 'POST' && request.url === '/measure') {
    const sample = JSON.parse(body);
    samples.push(sample);
    console.log(JSON.stringify(sample));
  } else if (request.method === 'POST' && request.url === '/done') {
    const result = JSON.parse(body);
    if (result.development || !result.lifecycleParity || result.samples.length !== samples.length) {
      throw new Error('Invalid benchmark result');
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify({ plan, ...result }, null, 2)}\n`);
    console.log(`Saved ${samples.length} samples to ${output}`);
    server.close();
  } else {
    response.writeHead(404);
  }
  response.end();
});
server.listen(8099, '127.0.0.1', () => console.log('Waiting for the release benchmark on port 8099'));
