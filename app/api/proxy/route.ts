import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Direct HTTP/HTTPS protocol validation
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }

    const response = await fetch(targetUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch target URL: ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error: any) {
    console.error("Storage Proxy Route Error:", error);
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}
