const fs = require('fs');

let content = fs.readFileSync('src/lib/agent/runner.ts', 'utf8');

const lines = content.split('\n');
const newLines = [];

let skipBlock = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (skipBlock) {
    if (line.includes('}')) {
      skipBlock = false;
    }
    continue;
  }

  if (line.match(/^\s*case\s*:\s*\{/)) {
    skipBlock = true;
    continue;
  }

  if (line.match(/^\s*case\s*:\s*hint\s*=/)) {
    continue; // skip single line cases
  }

  newLines.push(line);
}

fs.writeFileSync('src/lib/agent/runner.ts', newLines.join('\n'));
