import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function Home() {
  const cookieStore = cookies();
  const token = cookieStore.get('token');

  // 如果已登入，跳轉到市場監控頁面
  if (token) {
    redirect('/market-monitor');
  }

  // 如果未登入，跳轉到登入頁面
  redirect('/login');
}
