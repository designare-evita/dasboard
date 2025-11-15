// src/lib/get-session.ts
import { getServerSession as nextAuthGetServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getServerSession() {
  return await nextAuthGetServerSession(authOptions);
}
