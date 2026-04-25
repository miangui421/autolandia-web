export interface UtmData {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landing_page?: string;
  first_visit_at?: string;
}

export const UTM_COOKIE_NAME = 'al_utm';
export const UTM_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 días
export const UTM_PARAM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;
const FIELD_MAX_LEN = 200;

/** Trunca un string a FIELD_MAX_LEN chars. Preserva undefined. */
function clip(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s.length > FIELD_MAX_LEN ? s.slice(0, FIELD_MAX_LEN) : s;
}

/** Parse seguro de la cookie (JSON URL-encoded). Devuelve undefined si inválida. */
export function parseUtmCookie(raw: string | undefined | null): UtmData | undefined {
  if (!raw) return undefined;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    return parsed as UtmData;
  } catch {
    return undefined;
  }
}

/** Serializa UtmData a string URL-encoded listo para Set-Cookie. */
export function serializeUtmCookie(data: UtmData): string {
  return encodeURIComponent(JSON.stringify(data));
}

/**
 * Extrae UTMs de un URLSearchParams. Solo retorna si al menos uno de los 5
 * params estándar está presente. landing_page y first_visit_at se setean
 * por el caller (contexto específico).
 */
export function extractUtmsFromSearchParams(params: URLSearchParams): UtmData | undefined {
  const source = clip(params.get('utm_source') ?? undefined);
  const medium = clip(params.get('utm_medium') ?? undefined);
  const campaign = clip(params.get('utm_campaign') ?? undefined);
  const content = clip(params.get('utm_content') ?? undefined);
  const term = clip(params.get('utm_term') ?? undefined);

  if (!source && !medium && !campaign && !content && !term) return undefined;

  return { source, medium, campaign, content, term };
}
