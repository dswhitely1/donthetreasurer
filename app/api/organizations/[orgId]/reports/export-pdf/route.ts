import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { reportParamsSchema } from "@/lib/validations/report";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { fetchBudgetReportData } from "@/lib/reports/fetch-budget-data";
import { fetchSeasonsReportData } from "@/lib/reports/fetch-seasons-summary";
import { generateReportPdf } from "@/lib/pdf/generate-report";
import { getPresetDateRange } from "@/lib/fiscal-year";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Parse query params
  const url = new URL(request.url);
  const rawParams = {
    start_date: url.searchParams.get("start_date") ?? "",
    end_date: url.searchParams.get("end_date") ?? "",
    account_id: url.searchParams.get("account_id") ?? undefined,
    category_id: url.searchParams.get("category_id") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    preset: url.searchParams.get("preset") ?? undefined,
    budget_id: url.searchParams.get("budget_id") ?? undefined,
  };

  const parsed = reportParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify org ownership (RLS handles this but give a clear 404)
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, fiscal_year_start_month, seasons_enabled")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  try {
    const reportData = await fetchReportData(supabase, orgId, parsed.data);

    if (parsed.data.preset && parsed.data.preset !== "custom") {
      const range = getPresetDateRange(
        parsed.data.preset,
        org.fiscal_year_start_month ?? 1
      );
      if (range) {
        reportData.fiscalYearLabel = range.label;
      }
    }

    // Fetch budget data if budget_id provided
    const budgetData = parsed.data.budget_id
      ? await fetchBudgetReportData(supabase, parsed.data.budget_id)
      : null;

    if (parsed.data.budget_id && !budgetData) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    // Fetch seasons data when enabled (non-fatal if it fails)
    let seasonsData = null;
    if (org.seasons_enabled) {
      try {
        seasonsData = await fetchSeasonsReportData(supabase, orgId);
      } catch (seasonsError) {
        console.error("Failed to fetch seasons data for PDF export, proceeding without it:", seasonsError);
      }
    }

    const buffer = generateReportPdf(reportData, budgetData, seasonsData);

    const safeName = reportData.organizationName.replace(/[^a-zA-Z0-9]/g, "");
    const filename = `${safeName}_Transactions_${parsed.data.start_date}_to_${parsed.data.end_date}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF report export error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
