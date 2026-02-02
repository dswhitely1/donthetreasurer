import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; receiptId: string }> }
) {
  const { orgId, receiptId } = await params;
  const supabase = await createClient();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Verify org ownership (RLS handles this but give a clear 404)
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // Fetch receipt metadata (RLS enforced via transaction ownership chain)
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, storage_path, mime_type, file_name")
    .eq("id", receiptId)
    .single();

  if (!receipt) {
    return NextResponse.json(
      { error: "Receipt not found" },
      { status: 404 }
    );
  }

  // Generate signed URL (5-minute expiry)
  const { data: signedUrlData, error: signError } = await supabase.storage
    .from("receipts")
    .createSignedUrl(receipt.storage_path, 300);

  if (signError || !signedUrlData?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: signedUrlData.signedUrl,
    mimeType: receipt.mime_type,
    fileName: receipt.file_name,
  });
}
