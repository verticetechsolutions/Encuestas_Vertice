// Resend client + magic-link email. Server-only.

import { Resend } from 'resend';

let _client: Resend | null = null;
function client(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY no configurada en .env.local');
  _client = new Resend(key);
  return _client;
}

const FROM = process.env.EMAIL_FROM ?? 'hola@verticemexico.com';

export interface SendMagicLinkArgs {
  to: string;
  url: string;
  razon_social: string;
  expiresAt: Date;
}

export async function sendMagicLink({ to, url, razon_social, expiresAt }: SendMagicLinkArgs): Promise<void> {
  const fechaExpira = expiresAt.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const subject = `Tu acceso a Vértice — ${razon_social}`;
  const text = [
    `Hola,`,
    ``,
    `Te invitamos a participar en Vértice. Da click en el siguiente enlace para iniciar tu entrevista:`,
    ``,
    url,
    ``,
    `Este enlace es de un solo uso y expira el ${fechaExpira}. Después de ese momento, pídenos uno nuevo.`,
    ``,
    `— Vértice`,
  ].join('\n');
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px;">Tu acceso a Vértice</h2>
      <p>Hola,</p>
      <p>Te invitamos a participar en Vértice. Da click para iniciar tu entrevista para <strong>${escapeHtml(razon_social)}</strong>:</p>
      <p style="margin: 24px 0;">
        <a href="${url}" style="display: inline-block; padding: 12px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Iniciar entrevista</a>
      </p>
      <p style="font-size: 13px; color: #666;">Este enlace es de un solo uso y expira el ${fechaExpira}. Si no funciona, pídenos uno nuevo.</p>
      <p style="font-size: 13px; color: #666;">Si el botón no abre, copia esta liga: <br/><code style="font-size: 11px;">${url}</code></p>
    </div>
  `;
  const { error } = await client().emails.send({
    from: FROM,
    to,
    subject,
    text,
    html,
  });
  if (error) throw new Error(`Resend rechazó el envío: ${error.name} — ${error.message}`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
