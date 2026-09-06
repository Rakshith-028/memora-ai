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

async function proxyJsonResponse(
  response: Response
) {
  if (response.status === 204) {
    return new NextResponse(null, {
      status: 204,
    });
  }

  const text = await response.text();

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

  return NextResponse.json(data, {
    status: response.status,
  });
}

export async function GET(
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

    const url = new URL(request.url);

    const searchParams =
      url.searchParams.toString();

    const target =
      `${BACKEND_URL}/tasks${
        searchParams
          ? `?${searchParams}`
          : ""
      }`;

    const response = await fetch(
      target,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    return proxyJsonResponse(response);
  } catch (error) {
    console.error(
      "TASKS GET PROXY ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to load tasks.",
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
      `${BACKEND_URL}/tasks`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    return proxyJsonResponse(response);
  } catch (error) {
    console.error(
      "TASKS POST PROXY ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to create task.",
      },
      {
        status: 503,
      }
    );
  }
}