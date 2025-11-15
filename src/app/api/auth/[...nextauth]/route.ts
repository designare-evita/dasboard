// src/app/api/auth/[...nextauth]/route.ts

import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

const handler = NextAuth(authOptions);

// Manuelle Wrapper für Next.js 15 App Router Kompatibilität
export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handler(req as any, {} as any);
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handler(req as any, {} as any);
}
