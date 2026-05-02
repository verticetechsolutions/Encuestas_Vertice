// Inngest serve handler — endpoint que el plano de Inngest (cloud o dev server)
// usa para ejecutar functions cuando llega un evento.
//
// En dev: `npx inngest-cli dev` levanta un servidor local que descubre este
// endpoint en `http://localhost:3000/api/inngest`. En prod: la URL pública
// se registra en el dashboard de Inngest cloud al deployar.
//
// `serve` exporta los 3 verbs (GET/POST/PUT). GET sirve el manifest, POST
// recibe los triggers, PUT es para sync/handshake.

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { sintetizarSesion } from '@/lib/inngest/functions/sintetizarSesion';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sintetizarSesion],
});
