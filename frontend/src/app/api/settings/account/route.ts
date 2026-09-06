import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

async function getToken() {
  const cookieStore =
    await cookies();

  return cookieStore.get(
    "memora_access_token"
  )?.value;
}

async function proxyResponse(
  response: Response
) {
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
}

export async function GET() {
  try {
    const token =
      await getToken();

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
      `${BACKEND_URL}/settings/account`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    return proxyResponse(
      response
    );
  } catch (error) {
    console.error(
      "SETTINGS ACCOUNT GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to load account settings.",
      },
      {
        status: 503,
      }
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  try {
    const token =
      await getToken();

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

    const body =
      await request.json();

    const response = await fetch(
      `${BACKEND_URL}/settings/account`,
      {
        method: "PATCH",
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          body
        ),
        cache: "no-store",
      }
    );

    return proxyResponse(
      response
    );
  } catch (error) {
    console.error(
      "SETTINGS ACCOUNT PATCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to update account settings.",
      },
      {
        status: 503,
      }
    );
  }
}