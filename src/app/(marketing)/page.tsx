// Server component wrapper to fix Next.js 15.4.2 route group build issue
import HomePage from './HomePage';

export default function Page() {
  return <HomePage />;
}
