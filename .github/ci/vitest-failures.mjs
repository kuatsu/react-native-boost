import fs from 'node:fs';
import path from 'node:path';

const [directory, ...suites] = process.argv.slice(2);

for (const suite of suites) {
  const file = path.join(directory, `${suite}.json`);
  if (!fs.existsSync(file)) {
    console.log(`${suite}: tests did not run`);
    continue;
  }
  for (const result of JSON.parse(fs.readFileSync(file, 'utf8')).testResults) {
    const name = path.basename(result.name);
    const failed = result.assertionResults.filter((assertion) => assertion.status === 'failed');
    for (const assertion of failed) console.log(`${name} > ${assertion.fullName}`);
    if (result.status === 'failed' && failed.length === 0) console.log(`${name}: failed to load`);
  }
}
