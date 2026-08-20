import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fetchSeasonReport } from "@/lib/seasons/fetch-season-report";
import { generateLettersPdf } from "@/lib/pdf/generate-letters";

import type { LetterBatchData, LetterRecipient } from "@/lib/letters/types";

const requestSchema = z.object({
  template_id: z.string().uuid(),
  enrollment_ids: z.array(z.string().uuid()).min(1),
});

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
}

export async function POST(
  request: Request,
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
    .select(
      "id, name, seasons_enabled, director_name, director_title, director_email, director_phone"
    )
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { data: template } = await supabase
    .from("letter_templates")
    .select("id, heading, body, closing")
    .eq("id", parsed.data.template_id)
    .eq("organization_id", orgId)
    .single();

  if (!template) {
    return NextResponse.json(
      { error: "Letter template not found" },
      { status: 404 }
    );
  }

  try {
    const report = await fetchSeasonReport(supabase, seasonId);
    if (!report) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    // The client can only narrow this set, never widen it: an id from another
    // season simply fails to match anything the season report returned.
    const requested = new Set(parsed.data.enrollment_ids);
    const recipients: LetterRecipient[] = report.enrollments
      .filter(
        (enrollment) =>
          requested.has(enrollment.id) &&
          enrollment.enrollmentStatus === "enrolled" &&
          enrollment.balanceDue > 0
      )
      .map((enrollment) => ({
        enrollmentId: enrollment.id,
        studentFirstName: enrollment.studentFirstName,
        studentLastName: enrollment.studentLastName,
        guardianName: enrollment.guardianName,
        feeAmount: enrollment.feeAmount,
        totalPaid: enrollment.totalPaid,
        balanceDue: enrollment.balanceDue,
        payments: enrollment.payments.map((payment) => ({
          payment_date: payment.payment_date,
          amount: payment.amount,
          payment_method: payment.payment_method,
        })),
      }));

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No eligible recipients selected" },
        { status: 400 }
      );
    }

    // Local date, not UTC: this prints on letters handed to families, and a
    // UTC cutoff would date evening-generated batches "tomorrow" for most US
    // treasurers. en-CA formats as YYYY-MM-DD.
    const today = new Date().toLocaleDateString("en-CA");

    const batch: LetterBatchData = {
      organizationName: org.name,
      director: {
        name: org.director_name,
        title: org.director_title,
        email: org.director_email,
        phone: org.director_phone,
      },
      seasonName: report.seasonName,
      seasonStartDate: report.startDate,
      seasonEndDate: report.endDate,
      generatedOn: today,
      template: {
        heading: template.heading,
        body: template.body,
        closing: template.closing,
      },
      recipients,
    };

    const buffer = generateLettersPdf(batch);
    const filename = `${safeName(org.name)}_Letters_${safeName(report.seasonName)}_${today}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Season letters export error:", error);
    return NextResponse.json(
      { error: "Failed to generate letters" },
      { status: 500 }
    );
  }
}
