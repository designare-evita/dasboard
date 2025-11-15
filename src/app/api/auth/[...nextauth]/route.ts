// src/app/api/auth/[...nextauth]/route.ts

import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";

const handler = NextAuth(authOptions);

// Manuelle Wrapper für Next.js 15 App Router Kompatibilität
export async function GET(req: Request, context: any) {
  return handler(req, context);
}

export async function POST(req: Request, context: any) {
  return handler(req, context);
}
