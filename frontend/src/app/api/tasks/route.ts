import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Fetch tasks from backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/tasks`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Return empty array if backend is unavailable
      return NextResponse.json([]);
    }

    const tasks = await response.json();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks from backend:', error);
    // Return empty array as fallback
    return NextResponse.json([]);
  }
}
