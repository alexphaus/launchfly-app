import 'dotenv/config';

async function main() {
  const apiKey = process.env.VASTAI_API_KEY;
  const h = { 'Accept': 'application/json' };
  const getUrl = `https://console.vast.ai/api/v0/bundles/?api_key=${apiKey}&q=${encodeURIComponent(JSON.stringify({gpu_name:{eq:'RTX 4090'},num_gpus:{eq:1},rented:{eq:false},type:'on-demand'}))}`;
  
  const res = await fetch(getUrl, { headers: h });
  const o = (await res.json()).offers || [];
  
  console.log(`Total: ${o.length}`);
  console.log(`Port >= 1: ${o.filter(x => x.direct_port_count >= 1).length}`);
  console.log(`Disk >= 40: ${o.filter(x => x.disk_space >= 40).length}`);
  console.log(`Not CN/RU: ${o.filter(x => (!x.geolocation || (!x.geolocation.includes('CN') && !x.geolocation.includes('RU')))).length}`);
  
  const filtered = o.filter(x => x.direct_port_count >= 1 && x.disk_space >= 40 && (!x.geolocation || (!x.geolocation.includes('CN') && !x.geolocation.includes('RU'))));
  console.log(`Combined valid: ${filtered.length}`);
  console.log('Top 3 valid offers:');
  console.log(JSON.stringify(filtered.slice(0,3).map(x => ({id: x.id, price: x.dph_total, dl: x.inet_down})), null, 2));
}
main();
