import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('x_access_token')?.value;
  const userInfo = cookieStore.get('x_user_info')?.value;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const user = userInfo ? JSON.parse(userInfo) : null;
    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}