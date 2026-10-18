import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sameOrigin } from "@/lib/auth/http";
import {
  commitContactImport,
  previewContactImport,
} from "@/lib/contact-import";
import {
  MAX_IMPORT_REQUEST_BYTES,
  readImportRows,
} from "@/schemas/contact-import";

export const dynamic = "force-dynamic";

async function readBody(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("A JSON request body is required.");
  let size = 0;
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMPORT_REQUEST_BYTES) {
        await reader.cancel();
        throw new RangeError("Import request exceeds 4 MB.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Cross-site import requests are not allowed." },
      { status: 403 },
    );
  try {
    // Upstream sessions recheck the account's active state and current role.
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { error: "Sign in to import contacts." },
        { status: 401 },
      );
    if (!["ADMIN", "MEMBER"].includes(session.user.role))
      return NextResponse.json(
        { error: "You do not have permission to import contacts." },
        { status: 403 },
      );
    let mode: "preview" | "commit";
    let rows;
    try {
      const body = (await readBody(req)) as Record<string, unknown> | null;
      if (!body || (body.mode !== "preview" && body.mode !== "commit"))
        throw new Error("Choose preview or commit mode.");
      mode = body.mode;
      rows = readImportRows(body.rows);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof SyntaxError
              ? "Send valid JSON."
              : error instanceof Error
                ? error.message
                : "Invalid import request.",
        },
        { status: error instanceof RangeError ? 413 : 400 },
      );
    }
    const report =
      mode === "preview"
        ? await previewContactImport(rows)
        : await commitContactImport(rows, session.user.id);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Import could not be completed. Review the file again before retrying; any contacts already saved will be detected as duplicates.",
      },
      { status: 503 },
    );
  }
}
