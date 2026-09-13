import { parseResume } from "@/lib/resume/parser";
import { createClient } from "@/lib/supabase/server";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "PDF file is required." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return Response.json(
        { error: "Only PDF files are supported." },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return Response.json(
        { error: "PDF must be smaller than 5 MB." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));

    const result = await extractText(pdf, {
      mergePages: true,
    });

    const text = result.text.trim();

    if (!text) {
      return Response.json(
        {
          error:
            "No readable text was found in the PDF. The PDF may be image-based.",
        },
        { status: 422 },
      );
    }

    if (text.length > 250_000) {
      return Response.json({ error: "The PDF contains too much text to process safely." }, { status: 422 });
    }

    const parsedData = parseResume(text);

    return Response.json({
      success: true,
      text,
      pages: result.totalPages,
      parsedData,
    });
  } catch (error) {
    console.error("PDF PARSE ERROR:", error);

    return Response.json({ error: "Failed to parse PDF." }, { status: 500 });
  }
}
