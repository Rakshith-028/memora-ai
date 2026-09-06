import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

export async function GET() {
  try {
    const cookieStore =
      await cookies();

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

    const response = await fetch(
      `${BACKEND_URL}/analytics/overview`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const data =
      await response.json();

    return NextResponse.json(
      data,
      {
        status: response.status,
      }
    );
  } catch (error) {
    console.error(
      "ANALYTICS OVERVIEW PROXY ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to load analytics.",
      },
      {
        status: 503,
      }
    );
  }
}
