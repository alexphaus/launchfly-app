const fs = require('fs');

let content = fs.readFileSync('src/lib/agent/tools.ts', 'utf8');

// Use regex to remove executeDraftContent block
content = content.replace(/\/\/\s*───\s*draft_content[\s\S]*?async function executeDraftContent[\s\S]*?\n\}\n/m, '');

// Use regex to remove getWeatherEmoji and executeGetWeatherForecast blocks
content = content.replace(/\/\/\s*───\s*get_weather_forecast[\s\S]*?async function executeGetWeatherForecast[\s\S]*?\n\}\n/m, '');

fs.writeFileSync('src/lib/agent/tools.ts', content);
