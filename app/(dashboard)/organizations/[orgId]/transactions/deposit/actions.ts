"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { createFeeCompanionTransaction } from "@/lib/transactions/create-fee-companion";
import {
  depositFromQueueSchema,
  depositLinesArraySchema,
  ELECTRONIC_PAYMENT_METHODS,
} from "@/lib/validations/sponsor";

export async function createDepositFromQueue(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = depositFromQueueSchema.safeParse({
    organization_id: formData.get("organization_id") as string,
    account_id: formData.get("account_id") as string,
    transaction_date: formData.get("transaction_date") as string,
    description: formData.get("description") as string,
    status: (formData.get("status") as string) || "uncleared",
    cleared_at: (formData.get("cleared_at") as string) ?? "",
    apply_fee: (formData.get("apply_fee") as string) ?? "",
    lines: formData.get("lines") as string,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let rawLines: unknown;
  try {
    rawLines = JSON.parse(parsed.data.lines);
  } catch {
    return { error: "Deposit lines are malformed. Please try again." };
  }

  const parsedLines = depositLinesArraySchema.safeParse(rawLines);
  if (!parsedLines.success) {
    return { error: parsedLines.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const org = await fetchSponsorsOrg(supabase, parsed.data.organization_id);
  if (!org) return { error: "Sponsor tracking is not enabled." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id, fee_percentage, fee_flat_amount, fee_category_id")
    .eq("id", parsed.data.account_id)
    .eq("organization_id", parsed.data.organization_id)
    .eq("is_active", true)
    .single();

  if (!account) return { error: "Account not found." };

  // Amounts come from here, never from the form. The client chooses WHICH
  // payments to deposit and how to categorize them; what each one is worth is
  // already recorded.
  const sponsorshipIds = parsedLines.data.map((line) => line.sponsorship_id);
  const { data: sponsorships } = await supabase
    .from("sponsorships")
    .select(
      "id, amount, payment_method, transaction_id, sponsors!inner(organization_id, name), sponsor_levels(name)"
    )
    .in("id", sponsorshipIds)
    .eq("sponsors.organization_id", parsed.data.organization_id);

  const found = sponsorships ?? [];

  if (found.length !== sponsorshipIds.length) {
    return {
      error:
        "One or more selected payments are no longer in the queue. Reload the page and try again.",
    };
  }

  if (found.some((sponsorship) => sponsorship.transaction_id)) {
    return {
      error:
        "One or more selected payments have already been deposited. Reload the page and try again.",
    };
  }

  // PayPal money never rides along in a bank deposit: it lands in a different
  // account and carries a processing fee. Mixing the two would produce a
  // transaction that matches no real movement of money.
  const hasElectronic = found.some((s) =>
    ELECTRONIC_PAYMENT_METHODS.includes(s.payment_method as never)
  );
  const hasPhysical = found.some(
    (s) => !ELECTRONIC_PAYMENT_METHODS.includes(s.payment_method as never)
  );

  if (hasElectronic && hasPhysical) {
    return {
      error:
        "PayPal payments cannot be deposited together with cash or check payments. Deposit them separately.",
    };
  }

  const categoryIds = [...new Set(parsedLines.data.map((l) => l.category_id))];
  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .in("id", categoryIds)
    .eq("organization_id", parsed.data.organization_id)
    .eq("is_active", true);

  if ((categories?.length ?? 0) !== categoryIds.length) {
    return { error: "One or more categories are invalid or inactive." };
  }

  const amountById = new Map(found.map((s) => [s.id, Number(s.amount)]));
  const total = parsedLines.data.reduce(
    (sum, line) => sum + (amountById.get(line.sponsorship_id) ?? 0),
    0
  );

  let clearedAt: string | null = null;
  if (parsed.data.status === "cleared" || parsed.data.status === "reconciled") {
    clearedAt = parsed.data.cleared_at
      ? parsed.data.cleared_at + "T00:00:00.000Z"
      : new Date().toISOString();
  }

  const { data: transaction, error: txnError } = await supabase
    .from("transactions")
    .insert({
      account_id: parsed.data.account_id,
      transaction_date: parsed.data.transaction_date,
      amount: Number(total.toFixed(2)),
      transaction_type: "income",
      description: parsed.data.description,
      status: parsed.data.status,
      cleared_at: clearedAt,
    })
    .select("id")
    .single();

  if (txnError || !transaction) {
    return { error: "Failed to create the deposit. Please try again." };
  }

  const { error: liError } = await supabase.from("transaction_line_items").insert(
    parsedLines.data.map((line) => ({
      transaction_id: transaction.id,
      category_id: line.category_id,
      amount: amountById.get(line.sponsorship_id) ?? 0,
      memo: line.memo || null,
    }))
  );

  if (liError) {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id);

    if (deleteError) {
      return {
        error: `The deposit could not be completed and a partial transaction (id: ${transaction.id}) could not be removed automatically. Please delete transaction ${transaction.id} manually before trying again.`,
      };
    }

    return { error: "Failed to create the deposit lines. Please try again." };
  }

  // Claim the queue rows under the same condition that made them eligible.
  // Two tabs depositing the same check would otherwise both succeed, and the
  // money would be recorded twice.
  const { count: claimed, error: claimError } = await supabase
    .from("sponsorships")
    .update({ transaction_id: transaction.id }, { count: "exact" })
    .in("id", sponsorshipIds)
    .is("transaction_id", null);

  if (claimError || claimed !== sponsorshipIds.length) {
    await supabase
      .from("sponsorships")
      .update({ transaction_id: null })
      .eq("transaction_id", transaction.id);

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id);

    if (deleteError) {
      return {
        error: `The deposit could not be completed and a partial transaction (id: ${transaction.id}) could not be removed automatically. Please delete transaction ${transaction.id} manually before trying again.`,
      };
    }

    return {
      error:
        "One of these payments was deposited from another window while you were working. Nothing was saved — reload the page and try again.",
    };
  }

  if (parsed.data.apply_fee === "true") {
    const feeError = await createFeeCompanionTransaction(supabase, {
      account,
      amount: Number(total.toFixed(2)),
      transactionDate: parsed.data.transaction_date,
      description: parsed.data.description,
      status: parsed.data.status,
      clearedAt,
    });

    if (feeError) {
      revalidatePath("/dashboard", "layout");
      return feeError;
    }
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/transactions/${transaction.id}`
  );
}
