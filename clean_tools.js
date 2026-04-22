const fs = require('fs');

let content = fs.readFileSync('src/lib/agent/tools.ts', 'utf8');
const toolsToRemove = [
  'draft_content', 'get_weather_forecast', 'deep_research', 'run_code',
  'generate_video', 'generate_long_video', 'delegate_task_and_wait',
  'search_tasks', 'search_conversations'
];

let removed = [];
for (const tool of toolsToRemove) {
  const regex = new RegExp(`  \\{\\n    type: 'function' as const,\\n    function: \\{\\n      name: '${tool}',[\\s\\S]*?\\n  \\},\\n`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, '');
    removed.push(tool);
  } else {
    console.log('Could not find schema for: ' + tool);
  }
}

console.log('Removed schemas for:', removed);

fs.writeFileSync('src/lib/agent/tools.ts', content);
