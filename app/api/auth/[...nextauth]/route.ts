// Auth.js v6 endpoint catch-all. El runtime y todas las rutas
// (callback, signin, signout, csrf, providers, session) son provistas por
// los handlers GET/POST exportados desde `@/auth`.
//
// Runtime: Node (default). Edge no soporta todos los providers OAuth bien
// debido a APIs nativas de Node usadas en JWT signing internals.

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
