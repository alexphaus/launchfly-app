import 'dotenv/config';

const KEY = process.env.VASTAI_API_KEY;
const ID = process.env.VAST_INSTANCE_ID;

async function check() {
  const res = await fetch(`https://console.vast.ai/api/v0/instances/${ID}/`, {
    headers: { 'Authorization': `Bearer ${KEY}` }
  });
  const d = await res.json();
  const i = d.instances || d;
  const ports = i.ports || {};
  const comfyPort = ports['8188/tcp']?.[0]?.HostPort || 'none';
  return { status: i.actual_status, ip: i.public_ipaddr, port: comfyPort, msg: (i.status_msg || '').substring(0, 100), ssh_port: i.ssh_port };
}

async function main() {
  console.log(`Polling instance ${ID}...\n`);
  for (let i = 1; i <= 30; i++) {
    const info = await check();
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] #${i}: ${info.status} | IP: ${info.ip} | ComfyUI Port: ${info.port} | SSH: ${info.ssh_port} | ${info.msg}`);
    
    if (info.status === 'running' && info.port !== 'none') {
      console.log(`\nInstance is RUNNING. ComfyUI endpoint: http://${info.ip}:${info.port}`);
      
      // Try to hit ComfyUI
      try {
        const r = await fetch(`http://${info.ip}:${info.port}/system_stats`, { signal: AbortSignal.timeout(10000) });
        if (r.ok) {
          console.log('ComfyUI is responding.');
          return;
        }
      } catch {
        console.log('ComfyUI port open but not responding yet (onstart script still running)');
      }
    }
    
    if (info.status === 'exited') {
      console.log('Instance EXITED/CRASHED.');
      return;
    }
    
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log('Timed out after 5 minutes of polling.');
}

main().catch(console.error);
