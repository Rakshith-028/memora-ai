import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const token = cookieStore.get(
      "memora_access_token"
    )?.value;

    if (!token) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        {
          status: 401,
        }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const failedResponse =
        NextResponse.json(
          {
            authenticated: false,
          },
          {
            status: 401,
          }
        );

      failedResponse.cookies.delete(
        "memora_access_token"
      );

      return failedResponse;
    }

    const user = await response.json();

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error(
      "SESSION CHECK ERROR:",
      error
    );

    return NextResponse.json(
      {
        authenticated: false,
        detail:
          "Unable to verify the current session.",
      },
      {
        status: 503,
      }
    );
  }
}