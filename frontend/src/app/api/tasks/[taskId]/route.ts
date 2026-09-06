import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

async function getToken() {
  const cookieStore =
    await cookies();

  return cookieStore.get(
    "memora_access_token"
  )?.value;
}

async function proxyJsonResponse(
  response: Response
) {
  if (response.status === 204) {
    return new NextResponse(
      null,
      {
        status: 204,
      }
    );
  }

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

export async function GET(
  _request: NextRequest,
  context: RouteContext
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

    const { taskId } =
      await context.params;

    const response = await fetch(
      `${BACKEND_URL}/tasks/${taskId}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    return proxyJsonResponse(
      response
    );
  } catch (error) {
    console.error(
      "TASK GET PROXY ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to load task.",
      },
      {
        status: 503,
      }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
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

    const { taskId } =
      await context.params;

    const body =
      await request.json();

    const response = await fetch(
      `${BACKEND_URL}/tasks/${taskId}`,
      {
        method: "PUT",
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

    return proxyJsonResponse(
      response
    );
  } catch (error) {
    console.error(
      "TASK PUT PROXY ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to update task.",
      },
      {
        status: 503,
      }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
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

    const { taskId } =
      await context.params;

    const response = await fetch(
      `${BACKEND_URL}/tasks/${taskId}`,
      {
        method: "DELETE",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    return proxyJsonResponse(
      response
    );
  } catch (error) {
    console.error(
      "TASK DELETE PROXY ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to delete task.",
      },
      {
        status: 503,
      }
    );
  }
}