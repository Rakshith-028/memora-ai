import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

export async function POST(
  request: NextRequest
) {
  try {
    const cookieStore = await cookies();

    const token = cookieStore.get(
      "memora_access_token"
    )?.value;

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
      `${BACKEND_URL}/chat`,
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
      "CHAT PROXY ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to reach Memora AI.",
      },
      {
        status: 503,
      }
    );
  }
}