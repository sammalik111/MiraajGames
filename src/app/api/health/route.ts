// simple health check endpoint for monitoring and uptime checks
import { NextResponse } from 'next/server';
import { db } from "@/db";

export async function GET() {
  // Optional: Add logic to check database connectivity or other services
  try {
    await db.execute('SELECT 1'); // Simple query to check DB connection
  } catch (error) {
    return NextResponse.json({ status: 'error', timestamp: new Date().toISOString() }, { status: 500 });
  }
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { status: 200 });
}
