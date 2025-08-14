// src/lib/events-router.ts
import { emit, Event } from '@/lib/events';

export async function onBusinessCreated(payload: any) {
  await emit(Event.BusinessCreated, payload);
}


