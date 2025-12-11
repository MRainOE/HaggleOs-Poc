// app/api/analyze/route.ts
import { NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // for now, allow all; later  can restrict
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  // Handle CORS preflight
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: Request) {
  // Read the JSON body )
  const body = await request.json().catch(() => null);
  console.log('Received payload at /api/analyze:', body);

  // Fake response for now
  const responseData = {
    decision: 'NEGOTIATE',
    message: 'Hello from Vercel API (with CORS)!',
  };

  return NextResponse.json(responseData, {
    headers: CORS_HEADERS,
  });
}
