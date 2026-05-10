interface Props {
  searchParams: Promise<{ razon?: string }>;
}

const MENSAJES: Record<string, string> = {
  token_invalido: 'No reconocemos ese enlace. Probablemente está incompleto o ya fue revocado.',
  expirado: 'Tu enlace de acceso expiró. Vértice los emite con vigencia de 7 días.',
  consumido: 'Este enlace ya fue usado. Por seguridad sólo funciona una vez.',
  revocado: 'Este enlace fue revocado por el equipo Vértice. Solicita uno nuevo a tu contacto.',
  institucion_no_encontrada: 'No encontramos la institución asociada a este enlace.',
  sin_sesion: 'No tienes una sesión activa. Pide un enlace nuevo para iniciar.',
  rate_limited: 'Demasiados intentos en poco tiempo. Espera un minuto y vuelve a abrir tu enlace.',
};

export default async function AccesoExpiradoPage({ searchParams }: Props) {
  const { razon } = await searchParams;
  const mensaje =
    (razon && MENSAJES[razon]) ?? 'Algo salió mal con tu acceso. Pide un enlace nuevo a tu asesor de Vértice.';

  return (
    <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>No podemos darte acceso</h1>
      <p style={{ marginBottom: 16, color: '#444' }}>{mensaje}</p>
      <p style={{ color: '#666', fontSize: 14 }}>
        Escríbele a tu contacto de Vértice y te emitimos un enlace nuevo. Cada institución
        recibe el suyo por correo a la dirección que registramos en la invitación inicial.
      </p>
    </main>
  );
}
