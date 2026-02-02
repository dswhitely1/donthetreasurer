-- Migration: Receipt/Document Attachments
-- Allows users to attach receipt files (JPEG, PNG, WebP, PDF) to transactions.
-- Files stored in a private Supabase Storage bucket with signed URL access.

-- Create receipts table
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up receipts by transaction
CREATE INDEX idx_receipts_transaction_id ON public.receipts(transaction_id);

-- Reuse existing updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- RLS policy: access scoped through transactions -> accounts -> organizations ownership chain
CREATE POLICY "Users can access receipts on their transactions"
  ON public.receipts
  FOR ALL USING (
    transaction_id IN (
      SELECT t.id FROM public.transactions t
      JOIN public.accounts a ON t.account_id = a.id
      JOIN public.organizations o ON a.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

-- Create private storage bucket for receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Storage RLS: Users can read receipts in their organizations
CREATE POLICY "Users can read their receipt files"
  ON storage.objects
  FOR SELECT USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.treasurer_id = auth.uid()
    )
  );

-- Storage RLS: Users can upload receipts to their organizations
CREATE POLICY "Users can upload receipt files"
  ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.treasurer_id = auth.uid()
    )
  );

-- Storage RLS: Users can delete receipts from their organizations
CREATE POLICY "Users can delete their receipt files"
  ON storage.objects
  FOR DELETE USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.treasurer_id = auth.uid()
    )
  );
