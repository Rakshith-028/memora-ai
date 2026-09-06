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
      `${BACKEND_URL}/documents`,
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
      "DOCUMENT LIST ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to load documents.",
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

    const incomingFormData =
      await request.formData();

    const file =
      incomingFormData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          detail:
            "A document file is required.",
        },
        {
          status: 400,
        }
      );
    }

    const backendFormData =
      new FormData();

    backendFormData.append(
      "file",
      file,
      file.name
    );

    const response = await fetch(
      `${BACKEND_URL}/documents/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: backendFormData,
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
      "DOCUMENT UPLOAD ERROR:",
      error
    );

    return NextResponse.json(
      {
        detail:
          "Unable to upload document.",
      },
      {
        status: 503,
      }
    );
  }
}