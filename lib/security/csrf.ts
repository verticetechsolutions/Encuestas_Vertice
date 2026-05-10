// CSRF same-origin check para Route Handlers POST.
//
// Server Actions de Next 15 incorporan same-origin check built-in (validan
// que el header `Origin` matchee el `Host`). Route Handlers como
// `/api/turn` NO lo hacen automáticamente — si una víctima tiene la cookie
// `vertice_session` httpOnly y un atacante la engatusa a visitar otro
// origin que hace POST cross-origin, el browser ENVÍA la cookie (es
// `SameSite=lax`, que permite top-level navegaciones GET pero NO POST
// cross-origin desde JavaScript) y el servidor procesa el turn como
// auténtico.
//
// Nota: `SameSite=lax` ya bloquea el ataque XHR clásico. El check explícito
// es defensa en profundidad — si en un futuro alguien cambia el cookie a
// `SameSite=none` (e.g. para soportar embed cross-origin), este check sigue
// siendo la última barrera.
//
// Estrategia: comparar `Origin` (preferido) o `Referer` (fallback) contra
// `NEXT_PUBLIC_APP_URL`. Acepta también el host actual de la request por si
// la app corre en deploy preview con dominio variable.

const ALLOWED_HOSTS_FALLBACK = ['localhost:3000', '127.0.0.1:3000'];

function getAllowedOrigins(req: Request): string[] {
  const out: string[] = [];

  // 1. NEXT_PUBLIC_APP_URL es la fuente canónica para prod.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      out.push(new URL(appUrl).origin);
    } catch {
      // Malformed env — ignora silenciosamente, fallback al host del request.
    }
  }

  // 2. Self origin de la request (fallback robusto para deploy preview con
  //    dominio dinámico tipo *.vercel.app).
  try {
    const reqUrl = new URL(req.url);
    out.push(reqUrl.origin);
  } catch {
    // unreachable en práctica, pero noop por defensa.
  }

  // 3. Allowed hosts dev fallback (cuando NEXT_PUBLIC_APP_URL no está set y
  //    el origin de la request es dev local).
  if (process.env.NODE_ENV !== 'production') {
    for (const host of ALLOWED_HOSTS_FALLBACK) {
      out.push(`http://${host}`);
      out.push(`https://${host}`);
    }
  }

  return out;
}

/**
 * Valida que el request POST viene del mismo origin de la app. Devuelve
 * `null` si OK, o un mensaje de error legible si bloquea.
 *
 * Llamar al inicio de cada Route Handler que mute estado (POST/PUT/DELETE).
 * GET no lo necesita (el browser no incluye cookies cross-origin en GET vía
 * `<img>`/`<link>` salvo en navegación top-level, y para top-level un
 * atacante ya tiene control total).
 */
export function checkSameOrigin(req: Request): { ok: true } | { ok: false; error: string } {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // Si ni Origin ni Referer están presentes, rechazamos. Browsers modernos
  // siempre envían Origin para POST cross-origin; ausencia sugiere request
  // no-browser (curl, Postman) o fetch sin credentials. Para Route Handlers
  // gated por cookie, el cliente legítimo siempre envía credentials lo cual
  // implica Origin.
  if (!origin && !referer) {
    return {
      ok: false,
      error: 'missing_origin_and_referer',
    };
  }

  const allowed = getAllowedOrigins(req);

  // Origin es el preferido — más restrictivo (no incluye path).
  if (origin) {
    if (allowed.includes(origin)) return { ok: true };
    return {
      ok: false,
      error: `origin_not_allowed:${origin}`,
    };
  }

  // Fallback Referer — algunos browsers o configuraciones omiten Origin.
  // Comparamos solo el origin del referer.
  try {
    const refOrigin = new URL(referer!).origin;
    if (allowed.includes(refOrigin)) return { ok: true };
    return {
      ok: false,
      error: `referer_not_allowed:${refOrigin}`,
    };
  } catch {
    return { ok: false, error: 'referer_malformed' };
  }
}
