import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Fetch agendas from backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/agendas`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Return empty array if backend is unavailable
      return NextResponse.json([]);
    }

    const agendas = await response.json();
    return NextResponse.json(agendas);
  } catch (error) {
    console.error('Failed to fetch agendas from backend:', error);
    // Return empty array as fallback
    return NextResponse.json([]);
  }
}
