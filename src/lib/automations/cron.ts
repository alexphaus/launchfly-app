export interface ScheduleConfig {
  hour?: number;
  minute?: number;
  days?: string[];
  timezone?: string;
  qstashScheduleId?: string;
  _lastCron?: string;
}

export interface AutomationRule {
  id: string;
  event: string;
  enabled: boolean;
  scheduleConfig?: ScheduleConfig;
  [key: string]: any;
}

export async function syncBusinessCrons(
  businessId: string,
  rules: AutomationRule[],
): Promise<AutomationRule[]> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) return rules;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
  const triggerUrl = `${appUrl}/api/assistants/trigger`;
  const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';

  // Work on a deep copy so we can mutate scheduleConfig
  const updatedRules: AutomationRule[] = JSON.parse(JSON.stringify(rules));
  const scheduleRules = updatedRules.filter(r => r.event === 'daily_schedule');

  const tzOffsets: Record<string, number> = {
    'Pacific/Honolulu': -10, 'America/Los_Angeles': -8, 'America/Denver': -7,
    'America/Chicago': -6, 'America/New_York': -5, 'America/Sao_Paulo': -3,
    'Europe/London': 0, 'Europe/Madrid': 1, 'Europe/Istanbul': 3,
    'Asia/Dubai': 4, 'Asia/Kolkata': 5.5, 'Asia/Bangkok': 7,
    'Asia/Singapore': 8, 'Asia/Tokyo': 9, 'Australia/Sydney': 11,
  };
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  for (const rule of scheduleRules) {
    const cfg = rule.scheduleConfig || {};
    const hour = cfg.hour ?? 9;
    const minute = cfg.minute ?? 0;
    const days = cfg.days || ['mon', 'tue', 'wed', 'thu', 'fri'];
    const tz = cfg.timezone || 'America/New_York';

    const offset = tzOffsets[tz] ?? 0;
    let utcHour = hour - offset;
    let dayShift = 0;
    if (utcHour < 0) { utcHour += 24; dayShift = -1; }
    if (utcHour >= 24) { utcHour -= 24; dayShift = 1; }

    const dayNums = days.map(d => {
      let n = (dayMap[d.toLowerCase()] ?? 1) + dayShift;
      if (n < 0) n += 7;
      if (n > 6) n -= 7;
      return n;
    }).sort((a, b) => a - b).join(',');
    const cron = `${minute} ${Math.floor(utcHour)} * * ${dayNums}`;

    if (!rule.enabled) {
      // Delete existing schedule if any
      if (cfg.qstashScheduleId) {
        try {
          await fetch(`${qstashBase}/v2/schedules/${cfg.qstashScheduleId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${qstashToken}` },
          });
          console.log(`[biz-cron] Deleted schedule ${cfg.qstashScheduleId} for rule ${rule.id}`);
        } catch (e) {
          console.warn('[biz-cron] Delete schedule failed:', e);
        }
        rule.scheduleConfig = { ...cfg, qstashScheduleId: undefined };
      }
      continue;
    }

    // Skip recreating if cron hasn't changed and existing schedule is still valid
    if (cfg.qstashScheduleId && cfg._lastCron === cron) {
      // Verify the schedule still exists in QStash
      try {
        const checkRes = await fetch(`${qstashBase}/v2/schedules/${cfg.qstashScheduleId}`, {
          headers: { Authorization: `Bearer ${qstashToken}` },
        });
        if (checkRes.ok) {
          console.log(`[biz-cron] Schedule ${cfg.qstashScheduleId} unchanged for rule ${rule.id}, skipping`);
          continue;
        }
      } catch { /* schedule gone — recreate below */ }
    }

    // Clean up any stale schedules for this rule across QStash
    try {
      const listRes = await fetch(`${qstashBase}/v2/schedules`, {
        headers: { Authorization: `Bearer ${qstashToken}` },
      });
      if (listRes.ok) {
        const allSchedules = await listRes.json();
        for (const sched of allSchedules) {
          const isThisBusiness = sched.destination?.includes(businessId);
          let isThisRule = false;
          if (sched.body) {
            try {
              const raw = typeof sched.body === 'string' && sched.body.match(/^ey/)
                ? Buffer.from(sched.body, 'base64').toString()
                : sched.body;
              const parsed = JSON.parse(raw);
              isThisRule = parsed.ruleId === rule.id;
            } catch {
              try {
                isThisRule = Buffer.from(sched.body, 'base64').toString().includes(rule.id);
              } catch { /* skip */ }
            }
          }
          if (isThisBusiness && isThisRule) {
            await fetch(`${qstashBase}/v2/schedules/${sched.scheduleId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${qstashToken}` },
            });
            console.log(`[biz-cron] Cleaned up old schedule ${sched.scheduleId} for rule ${rule.id}`);
          }
        }
      }
    } catch (e) {
      console.warn('[biz-cron] Error cleaning up old schedules:', e);
    }

    // Create new QStash schedule
    const targetWithBiz = `${triggerUrl}?businessId=${encodeURIComponent(businessId)}`;
    const res = await fetch(`${qstashBase}/v2/schedules/${targetWithBiz}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Cron': cron,
        'Upstash-Retries': '0',
      },
      body: JSON.stringify({
        businessId,
        event: 'daily_schedule',
        ruleId: rule.id,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      rule.scheduleConfig = { ...cfg, qstashScheduleId: data.scheduleId, _lastCron: cron };
      console.log(`[biz-cron] Created schedule ${data.scheduleId} for rule ${rule.id}: ${cron} (${tz})`);
    } else {
      console.error(`[biz-cron] Failed to create schedule for rule ${rule.id}:`, await res.text());
    }
  }

  return updatedRules;
}
