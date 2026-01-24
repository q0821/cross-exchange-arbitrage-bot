import { redirect } from 'next/navigation';

/**
 * Admin Index Page (Feature 068)
 *
 * 自動重導向到 Dashboard
 */
export default function AdminIndexPage() {
  redirect('/admin/dashboard');
}
