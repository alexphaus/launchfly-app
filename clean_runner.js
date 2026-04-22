const fs = require('fs');

let toolsContent = fs.readFileSync('src/lib/agent/tools.ts', 'utf8');

// Use regex to remove executeRunCode block
toolsContent = toolsContent.replace(/\/\/\s*───\s*run_code[\s\S]*?async function executeRunCode[\s\S]*?\n\}\n/m, '');

// Clean up jsdoc
toolsContent = toolsContent.replace(/run_code,\s*/g, '');

fs.writeFileSync('src/lib/agent/tools.ts', toolsContent);

let runnerContent = fs.readFileSync('src/lib/agent/runner.ts', 'utf8');

// remove tools from PARALLEL_SAFE_TOOLS / IDEMPOTENT_TOOLS arrays
const deletedTools = ['draft_content', 'get_weather_forecast', 'delegate_task_and_wait', 'run_code', 'search_tasks', 'search_conversations', 'generate_video', 'generate_long_video'];

for (const tool of deletedTools) {
  const regex = new RegExp(`['"]${tool}['"]\\s*,?\\s*`, 'g');
  runnerContent = runnerContent.replace(regex, '');
}

// remove UI hints in runner
for (const tool of deletedTools) {
  const regexUI = new RegExp(`${tool}:\\s*['"].*?['"]\\s*,\\s*`, 'g');
  runnerContent = runnerContent.replace(regexUI, '');
  
  const regexSwitch = new RegExp(`case\\s+['"]${tool}['"]:[\\s\\S]*?break;\\s*`, 'g');
  runnerContent = runnerContent.replace(regexSwitch, '');
  
  // also handle run_code special block in switch
  if (tool === 'run_code') {
    const runCodeSwitch = new RegExp(`case\\s+['"]run_code['"]:[\\s\\S]*?\\}\\s*`, 'g');
    runnerContent = runnerContent.replace(runCodeSwitch, '');
  }
}

// delete system prompt rules
runnerContent = runnerContent.replace(/- delegate_task = fire-and-forget\. delegate_task_and_wait = you need the result to continue\./g, '- delegate_task = delegate to another agent. Use wait_for_completion=true if you need the result to continue.');
runnerContent = runnerContent.replace(/-\s+\*\*run_code\*\*.*?\n/g, '');

fs.writeFileSync('src/lib/agent/runner.ts', runnerContent);

console.log("Cleanup complete!");
