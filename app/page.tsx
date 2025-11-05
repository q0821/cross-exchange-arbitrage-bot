import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function Home() {
  const cookieStore = cookies();
  const token = cookieStore.get('token');

  // 如果已登入，跳轉到套利機會頁面
  if (token) {
    redirect('/opportunities');
  }

  // 如果未登入，跳轉到登入頁面
  redirect('/login');
}
