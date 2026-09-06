import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

async function getToken() {
  const cookieStore = await cookies();

  return cookieStore.get(
    "memora_access_token"
  )?.value;
}

export async function GET() {
  try {
    const token = await getToken();

    if (!token) {
      return NextResponse.json(
        {
          detail: "Not authenticated",
        },
        {
          status: 401,
        }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/memories`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(
      data,
      {
        status: response.status,
      }
    );
  } catch (error) {
    console.error(
      "MEMORY LIST ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to load memories.",
      },
      {
        status: 503,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const token = await getToken();

    if (!token) {
      return NextResponse.json(
        {
          detail: "Not authenticated",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/memories`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(
      data,
      {
        status: response.status,
      }
    );
  } catch (error) {
    console.error(
      "MEMORY CREATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to create memory.",
      },
      {
        status: 503,
      }
    );
  }
}
