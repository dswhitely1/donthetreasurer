import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { formatTermLabel } from "@/lib/sponsors/sponsorship-year";
import { buildSponsorTokenValues } from "@/lib/letters/sponsor-token-values";
import { generateLettersPdf } from "@/lib/pdf/generate-letters";
import { sponsorLetterRequestSchema } from "@/lib/validations/sponsor";

import type { LetterBatchData, LetterRecipient } from "@/lib/letters/types";
import type { SponsorPaymentMethod } from "@/lib/validations/sponsor";

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = sponsorLetterRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { data: template } = await supabase
    .from("letter_templates")
    .select("id, heading, body, closing, template_type")
    .eq("id", parsed.data.template_id)
    .eq("organization_id", orgId)
    .eq("template_type", "sponsor_acknowledgment")
    .single();

  if (!template) {
    return NextResponse.json(
      { error: "Letter template not found" },
      { status: 404 }
    );
  }

  // Defense in depth: the query above already scopes to the sponsor
  // template type, but a mismatched row reaching this point (from a stale
  // cache or a query change elsewhere) should never render blank
  // placeholders on a letter — it should fail loudly instead.
  if (template.template_type !== "sponsor_acknowledgment") {
    return NextResponse.json(
      { error: "This template is not a sponsor acknowledgment template." },
      { status: 400 }
    );
  }

  try {
    const { data: orgDetails } = await supabase
      .from("organizations")
      .select("ein, director_name, director_title, director_email, director_phone")
      .eq("id", orgId)
      .single();

    const director = {
      name: orgDetails?.director_name ?? null,
      title: orgDetails?.director_title ?? null,
      email: orgDetails?.director_email ?? null,
      phone: orgDetails?.director_phone ?? null,
    };

    // Local date, not UTC: this prints on letters handed to sponsors, and a
    // UTC cutoff would date evening-generated batches "tomorrow" for most US
    // treasurers. en-CA formats as YYYY-MM-DD.
    const today = new Date().toLocaleDateString("en-CA");

    // The client can only narrow this set, never widen it: an id outside the
    // organization simply never matches a row this query returns.
    const { data: sponsorships } = await supabase
      .from("sponsorships")
      .select(
        "id, amount, payment_method, received_date, term_start_date, term_end_date, sponsors!inner(name, contact_name, organization_id), sponsor_levels(name)"
      )
      .in("id", parsed.data.sponsorship_ids)
      .eq("sponsors.organization_id", orgId)
      .order("received_date", { ascending: true });

    const rows = sponsorships ?? [];

    const recipients: LetterRecipient[] = rows.map((row) => ({
      id: row.id,
      tokenValues: buildSponsorTokenValues({
        organizationName: org.name,
        organizationEin: orgDetails?.ein ?? null,
        director,
        generatedOn: today,
        sponsorName: row.sponsors.name,
        contactName: row.sponsors.contact_name,
        levelName: row.sponsor_levels?.name ?? null,
        amount: row.amount,
        receivedDate: row.received_date,
        paymentMethod: row.payment_method as SponsorPaymentMethod,
        termStartDate: row.term_start_date,
        termEndDate: row.term_end_date,
      }),
    }));

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No eligible sponsorships selected" },
        { status: 400 }
      );
    }

    const termLabel = formatTermLabel(
      rows[0].term_start_date,
      rows[0].term_end_date
    );

    const batch: LetterBatchData = {
      organizationName: org.name,
      director,
      generatedOn: today,
      template: {
        heading: template.heading,
        body: template.body,
        closing: template.closing,
      },
      recipients,
    };

    const buffer = generateLettersPdf(batch);
    const filename = `${safeName(org.name)}_Sponsor_Letters_${safeName(termLabel)}_${today}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Sponsor letters export error:", error);
    return NextResponse.json(
      { error: "Failed to generate letters" },
      { status: 500 }
    );
  }
}
