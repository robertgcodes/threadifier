"use client";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export const dynamic = 'force-dynamic';

const LoginPage = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main page since login is handled inline now
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-legal-50">
      <div className="card max-w-sm w-full">
        <p className="text-center text-legal-600">Redirecting...</p>
      </div>
    </div>
  );
};

export default LoginPage; 