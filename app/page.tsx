import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to login page (will be implemented in Phase 3)
  redirect('/login');
}
