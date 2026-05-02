// Inngest client singleton para Vértice. Greenfield (no había client previo
// en el repo al cierre de step 5 sub-paso vi).
//
// El `id: 'vertice'` agrupa todas las functions de la app. Inngest v4 ya no
// expone `EventSchemas.fromRecord<>()` en el top-level export; el typing del
// payload lo provee TypeScript estructuralmente desde quien llama
// `inngest.send({ name, data })` (motor pasa `SesionListaParaSintesisPayload`).
//
// En dev sin keys: Inngest dev server (npx inngest-cli dev) recibe los sends
// localmente. En prod: claves INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY de
// `.env.local`. Ambas declaradas en `.env.example` desde antes de step 5.

import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'vertice' });
