import { Sandbox } from '@e2b/code-interpreter';

async function test() {
  const sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY });
  console.log("Installing weasyprint...");
  const res = await sandbox.runCode(`
import subprocess
res = subprocess.run(['pip', 'install', 'weasyprint'], capture_output=True, text=True)
print(res.stdout)
print(res.stderr)

import weasyprint
weasyprint.HTML(string="<h1>Hello</h1>").write_pdf('/tmp/out.pdf')
print("Weasyprint success!")
  `);
  console.log(res.logs.stdout.join('\n'));
  console.log(res.logs.stderr.join('\n'));
  await sandbox.kill();
}

test().catch(console.error);
