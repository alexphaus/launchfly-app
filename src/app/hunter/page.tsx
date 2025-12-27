import { getRecentLeads } from './actions';
import HunterInterface from './hunter-interface';

export const dynamic = 'force-dynamic';

export default async function HunterPage() {
  const leads = await getRecentLeads();
  
  return <HunterInterface initialLeads={leads || []} />;
}
