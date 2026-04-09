'use server';
import { createServerClient } from '@/lib/supabase-server';
import { analyzeReceipt } from '@/lib/vision-analyzer';
import { validatePaymentSecurity } from '@/lib/fraud-detector';
import type { FraudCheckResult } from '@/types';

export async function validatePayment(
  formData: FormData,
  expectedAmount: number,
): Promise<{ result: FraudCheckResult; receiptUrl: string }> {
  const file = formData.get('receipt') as File;
  if (!file) throw new Error('No se envio comprobante');
  if (file.size > 5 * 1024 * 1024) throw new Error('El archivo excede 5MB');

  const supabase = createServerClient();

  // Upload to Supabase Storage
  const now = new Date();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `receipts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/pending-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, arrayBuffer, { contentType: file.type });

  if (uploadError) throw new Error('Error subiendo comprobante');

  const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
  const receiptUrl = urlData.publicUrl;

  // Analyze with GPT-4o Vision
  const visionResult = await analyzeReceipt(receiptUrl);

  // Security validation
  const result = await validatePaymentSecurity(visionResult, expectedAmount);

  return { result, receiptUrl };
}
