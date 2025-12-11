// app/api/analyse/route.ts
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
  "decision": "NEGOTIATE",
  "market_price": 450,
  "defects_found": ["scratch on lens"],
  "suggested_offer": 380,
  "draft_message": "Hi, I noticed..."
};

  return NextResponse.json(responseData, {
    headers: CORS_HEADERS,
  });
}
