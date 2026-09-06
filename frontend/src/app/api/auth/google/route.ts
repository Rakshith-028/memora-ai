import {
  NextRequest,
  NextResponse,
} from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

const SESSION_MAX_AGE_SECONDS =
  60 * 60;

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const response =
      await fetch(
        `${BACKEND_URL}/auth/google`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(body),
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          detail:
            data?.detail ??
            "Unable to sign in with Google.",
        },
        {
          status: response.status,
        }
      );
    }

    const accessToken =
      data?.access_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          detail:
            "Authentication server did not return an access token.",
        },
        {
          status: 502,
        }
      );
    }

    const nextResponse =
      NextResponse.json({
        authenticated: true,
      });

    nextResponse.cookies.set(
      "memora_access_token",
      accessToken,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge:
          SESSION_MAX_AGE_SECONDS,
      }
    );

    return nextResponse;
  } catch (error) {
    console.error(
      "GOOGLE LOGIN PROXY ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to reach the authentication service.",
      },
      {
        status: 503,
      }
    );
  }
}