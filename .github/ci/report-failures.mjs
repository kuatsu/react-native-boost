import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const { LABEL, TITLE, DETAILS, FAILURES_FILE, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
const listedFailures = 100;
const seenPattern = /<!-- seen:([\da-f,]*) -->/;

const gh = (...arguments_) => execFileSync('gh', arguments_, { encoding: 'utf8' });
const digest = (failure) => createHash('sha256').update(failure).digest('hex').slice(0, 12);
const list = (failures) =>
  [
    '```text',
    ...failures.slice(0, listedFailures),
    ...(failures.length > listedFailures ? [`and ${failures.length - listedFailures} more`] : []),
    '```',
  ].join('\n');

const failures = fs.existsSync(FAILURES_FILE)
  ? [...new Set(fs.readFileSync(FAILURES_FILE, 'utf8').split('\n').filter(Boolean))].sort()
  : [];
if (failures.length === 0) failures.push('The job failed without a recorded failure');

gh('label', 'create', LABEL, '--force');
const [issue] = JSON.parse(
  gh('issue', 'list', '--state', 'open', '--label', LABEL, '--limit', '1', '--json', 'number,body')
);
const seen = seenPattern.exec(issue?.body ?? '')?.[1].split(',') ?? [];
const added = failures.filter((failure) => !seen.includes(digest(failure)));
const details = `${DETAILS}\n- Run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
const body = `${details}\n\nFailures in the last failed run:\n\n${list(failures)}\n\n<!-- seen:${[...seen, ...added.map((failure) => digest(failure))].join(',')} -->`;

if (issue) {
  gh('issue', 'edit', String(issue.number), '--body', body);
  if (added.length > 0) {
    gh('issue', 'comment', String(issue.number), '--body', `New failures:\n\n${list(added)}\n\n${details}`);
  }
} else {
  gh('issue', 'create', '--title', TITLE, '--label', LABEL, '--body', body);
}
