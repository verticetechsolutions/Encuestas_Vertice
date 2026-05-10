'use server';

import { redirect } from 'next/navigation';
import { clearSessionCookie } from '@/lib/auth/cookie';

// Server Action para que el usuario invalide su cookie de sesión sin esperar
// el TTL de 30 días. La cookie es opaca (sesion_id UUID) y se valida vía DB
// lookup en cada request, así que clear-cookie + redirect basta para cortar
// el acceso a /entrevista/* desde este browser.
//
// NOTA: NO marca la sesión como `abandonada` ni cierra el server-side state.
// El usuario podría re-entrar con un nuevo magic link y reanudar (la sesión
// existe en `sesiones` con status='abierta' hasta que el flujo de síntesis
// la cierre). Esto es intencional — un logout por error humano (e.g.
// computadora compartida) no debe destruir el progreso de la entrevista.
//
// Si en el futuro se requiere un "abandonar entrevista" explícito, agregar
// otra Server Action que además haga UPDATE sesiones SET status='abandonada'.
export async function logoutSesion(): Promise<void> {
  await clearSessionCookie();
  redirect('/');
}
