// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// Next.js 15 erwartet explizite Named Exports
export async function GET(req: Request, context: { params: { nextauth: string[] } }) {
  return handler(req, context);
}

export async function POST(req: Request, context: { params: { nextauth: string[] } }) {
  return handler(req, context);
}
