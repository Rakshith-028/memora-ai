import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.MEMORA_BACKEND_URL ??
  "http://127.0.0.1:8000";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
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

    const { documentId } =
      await context.params;

    const response = await fetch(
      `${BACKEND_URL}/documents/${documentId}`,
      {
        method: "DELETE",
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
      "DOCUMENT DELETE ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to delete document.",
      },
      {
        status: 503,
      }
    );
  }
}