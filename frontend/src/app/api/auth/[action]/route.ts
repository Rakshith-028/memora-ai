import {
  NextRequest,
  NextResponse,
} from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

const ALLOWED_ACTIONS = new Set([
  "register",
  "verify-email",
  "resend-verification",
  "forgot-password",
  "reset-password",
]);

type RouteContext = {
  params: Promise<{
    action: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { action } =
      await context.params;

    if (
      !ALLOWED_ACTIONS.has(action)
    ) {
      return NextResponse.json(
        {
          detail:
            "Unsupported authentication action.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const response =
      await fetch(
        `${BACKEND_URL}/auth/${action}`,
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

    const text =
      await response.text();

    let data: unknown = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {
          detail: text,
        };
      }
    }

    return NextResponse.json(
      data,
      {
        status: response.status,
      }
    );
  } catch (error) {
    console.error(
      "AUTH ACTION PROXY ERROR:",
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