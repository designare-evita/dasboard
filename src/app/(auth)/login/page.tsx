// src/app/(auth)/login/page.tsx
import Image from 'next/image';
import { Suspense } from 'react';
import LoginForm from './LoginForm';

// Verbesserte Loading-Komponente mit gleichem Layout wie LoginForm
function LoginLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 h-[45px] w-[180px] bg-gray-200 animate-pulse rounded" />
          <p className="mt-2 text-gray-600">Wird geladen...</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
