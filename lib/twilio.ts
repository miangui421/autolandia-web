import twilio from 'twilio';

/**
 * Cliente Twilio con lazy initialization.
 * Evita problemas durante build/SSG cuando las env vars no están disponibles.
 */
let _client: ReturnType<typeof twilio> | null = null;
function getTwilio() {
  if (!_client) {
    _client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  }
  return _client;
}

/**
 * Envía un código de verificación via Twilio Verify Service.
 * El Verify Service genera el código automáticamente y usa el template
 * configurado en Twilio Console (en español, branded "Autolandia").
 */
export async function sendVerification(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await getTwilio()
      .verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: phone, channel: 'sms', locale: 'es' });

    if (result.status === 'pending') {
      return { success: true };
    }
    return { success: false, error: `Estado inesperado: ${result.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Twilio Verify send error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Valida un código contra Twilio Verify.
 * Retorna approved=true si el código es correcto.
 */
export async function checkVerification(
  phone: string,
  code: string,
): Promise<{ approved: boolean; error?: string }> {
  try {
    const result = await getTwilio()
      .verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phone, code });

    return { approved: result.status === 'approved' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    // Twilio retorna 404 si el código expiró — normalizar mensaje
    if (msg.includes('20404') || msg.toLowerCase().includes('not found')) {
      return { approved: false, error: 'Codigo expirado. Solicita uno nuevo.' };
    }
    console.error('Twilio Verify check error:', msg);
    return { approved: false, error: 'Codigo incorrecto' };
  }
}
