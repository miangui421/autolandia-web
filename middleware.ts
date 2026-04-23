// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const FBC_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 días (convención Meta)
// fbclid de Meta es URL-safe (base64url). Validamos para evitar poisoning de
// la cookie _fbc si alguien manipula el query param.
const FBCLID_REGEX = /^[A-Za-z0-9_-]{1,512}$/;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const fbclid = request.nextUrl.searchParams.get('fbclid');
  if (fbclid && FBCLID_REGEX.test(fbclid)) {
    const existing = request.cookies.get('_fbc')?.value;
    const expectedValue = `fb.1.${Date.now()}.${fbclid}`;
    // Parseamos el último segmento del valor existente (formato fb.1.{ts}.{fbclid})
    // para comparar con el nuevo fbclid. Más robusto que endsWith.
    const existingFbclid = existing?.split('.').at(-1);
    if (existingFbclid !== fbclid) {
      response.cookies.set('_fbc', expectedValue, {
        maxAge: FBC_MAX_AGE_SECONDS,
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  return response;
}

export const config = {
  // Matcher de middleware Next.js: corre en todas las rutas excepto las listadas.
  // Usamos negative lookahead (?!...) al inicio del primer segmento del path
  // para excluir /admin/* (auth admin usa cookie TOTP, no middleware), /api/*,
  // y assets estáticos de Next. Todo lo demás (landing, /checkout, /login, /mis-boletos)
  // pasa por el middleware y recibe la cookie _fbc si hay ?fbclid=.
  matcher: [
    '/((?!admin|api|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
