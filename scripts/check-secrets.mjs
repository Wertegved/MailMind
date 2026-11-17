import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', '.vercel', '.next', 'coverage']);
const ignoredFiles = new Set(['.env', '.env.local', '.env.example', 'README.md', 'DEPLOYMENT.md', 'DEMO.md']);

const secretPatterns = [
  /(^|[^A-Z0-9_])(?:GROQ_API_KEY|OPENAI_API_KEY|OPENAI_SECRET|API_KEY|SECRET_KEY|PRIVATE_KEY)\s*[:=]\s*["']?[A-Za-z0-9_+/=-]{24,}["']?(?:$|[^A-Z0-9_])/im,
  /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i,
];

const filesToCheck = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (ignoredFiles.has(entry.name)) continue;
    filesToCheck.push(fullPath);
  }
}

walk(root);
const offenders = [];

for (const file of filesToCheck) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const isPlaceholder = /(?:<your|example|placeholder|changeme|replace_me|dummy|sample|demo|your_[a-z_]+|test_value)/i.test(text);
  if (isPlaceholder && !secretPatterns.some((pattern) => pattern.test(text))) {
    continue;
  }

  if (secretPatterns.some((pattern) => pattern.test(text))) {
    offenders.push(path.relative(root, file));
  }
}

if (offenders.length > 0) {
  console.error('Possible secret material found:');
  for (const offender of offenders) console.error(` - ${offender}`);
  process.exit(1);
}

console.log('No likely secret material found in the repository source files.');
