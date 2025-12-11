// app/api/analyze/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
// DUMMY RESPONSE
  return NextResponse.json({
    decision: 'NEGOTIATE',
    message: 'Hello from Vercel API',
  });
}
