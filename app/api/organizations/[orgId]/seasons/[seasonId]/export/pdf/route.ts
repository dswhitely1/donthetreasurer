import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { fetchSeasonReport } from "@/lib/seasons/fetch-season-report";
import { generateSeasonReportPdf } from "@/lib/pdf/generate-season-report";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; seasonId: string }> }
) {
  const { orgId, seasonId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  if (!org.seasons_enabled) {
    return NextResponse.json(
      { error: "Season tracking is not enabled" },
      { status: 404 }
    );
  }

  try {
    const data = await fetchSeasonReport(supabase, seasonId);
    if (!data) {
      return NextResponse.json(
        { error: "Season not found" },
        { status: 404 }
      );
    }

    const buffer = generateSeasonReportPdf(data);
    const today = new Date().toISOString().split("T")[0];
    const safeName = (s: string) =>
      s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const filename = `${safeName(org.name)}_Season_${safeName(data.seasonName)}_${today}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
