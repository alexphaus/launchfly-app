const url = "https://jahdnckxduwkxodyjbnq.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphaGRuY2t4ZHV3a3hvZHlqYm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MDE2OCwiZXhwIjoyMDY4ODU2MTY4fQ.9O3NmxvU8AhuaNrsTdE34FJfSrqrDT6whLmCjoUdiEE";
const h = { apikey: key, Authorization: "Bearer " + key };

async function check() {
  // 1. Today's quote_leads
  const leads = await fetch(url + "/rest/v1/quote_leads?created_at=gte.2026-03-13T05:50:00Z&order=created_at.asc&select=id,phone,name,source,status,created_at", { headers: h }).then(r => r.json());
  console.log("=== TODAY'S QUOTE_LEADS ===");
  console.log("Total:", leads.length);
  leads.forEach(l => console.log(l.created_at?.substring(11,19), "|", (l.name || "").substring(0,40).padEnd(40), "|", (l.phone || "").padEnd(16), "|", l.status));

  // 2. Customers for these phones
  const phones = leads.map(l => l.phone?.replace(/^\+/, "")).filter(Boolean);
  if (phones.length > 0) {
    const orFilter = phones.map(p => "phone.eq.%2B" + p).join(",");
    const custs = await fetch(url + "/rest/v1/customers?or=(" + orFilter + ")&select=phone,name,status,created_at&order=created_at.desc", { headers: h }).then(r => r.json());
    console.log("\n=== CUSTOMERS FOR THESE LEADS ===");
    console.log("Total:", custs.length);
    custs.forEach(c => console.log(c.created_at?.substring(0,19), "|", (c.name || "").substring(0,35).padEnd(35), "|", (c.phone || "").padEnd(16), "|", c.status));
  }

  // 3. Chat history for these phones (outbound only)
  if (phones.length > 0) {
    const orFilter2 = phones.map(p => "phone.eq." + p).join(",");
    const msgs = await fetch(url + "/rest/v1/chat_history?or=(" + orFilter2 + ")&role=eq.assistant&created_at=gte.2026-03-13T05:50:00Z&order=created_at.asc&select=phone,content,created_at", { headers: h }).then(r => r.json());
    console.log("\n=== OUTBOUND MESSAGES TO TODAY'S LEADS ===");
    console.log("Total:", msgs.length);
    msgs.forEach(m => console.log(m.created_at?.substring(11,19), "|", ("+" + m.phone).padEnd(16), "|", (m.content || "").substring(0,80)));
  }

  // 4. Check if outreach is paused
  const biz = await fetch(url + "/rest/v1/businesses?select=name,outreach_paused&limit=5", { headers: h }).then(r => r.json());
  console.log("\n=== BUSINESS OUTREACH STATUS ===");
  biz.forEach(b => console.log(b.name, "| outreach_paused:", b.outreach_paused));
}

check().catch(console.error);
