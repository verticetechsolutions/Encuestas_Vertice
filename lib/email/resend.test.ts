// Unit tests para `sendSintesisCompleta` + `parseAdminEmails` (Fase 8).
//
// `sendMagicLink` no se cubre aquí — existe desde Fase 4 sin tests dedicados
// (cobertura indirecta via flujos auth E2E). Este archivo se enfoca en la
// notificación de síntesis recién agregada.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del SDK de Resend a nivel módulo. Usamos `vi.hoisted` porque `vi.mock`
// se hoistea al top del file y el mock factory necesita referenciar `sendMock`
// que de otro modo estaría en TDZ. `vi.hoisted` retorna valores definidos antes
// del hoisting de vi.mock.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
  // El SDK de Resend exporta `Resend` como class. Para que `new Resend(key)`
  // funcione, el mock debe ser una class real (o función llamable con `new`).
  Resend: class MockResend {
    emails = { send: sendMock };
    // El constructor real toma una key; aquí lo ignoramos.
    constructor(_key: string) {}
  },
}));

import { sendSintesisCompleta, parseAdminEmails } from './resend';

describe('parseAdminEmails', () => {
  it('devuelve [] cuando la var no está', () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
  });

  it('devuelve [] cuando la var es string vacía', () => {
    expect(parseAdminEmails('')).toEqual([]);
  });

  it('split por coma con trim', () => {
    expect(parseAdminEmails('a@b.com, c@d.com ,e@f.com')).toEqual([
      'a@b.com',
      'c@d.com',
      'e@f.com',
    ]);
  });

  it('filtra entradas vacías por comas dobles o trailing comma', () => {
    expect(parseAdminEmails('a@b.com,,c@d.com,')).toEqual([
      'a@b.com',
      'c@d.com',
    ]);
  });

  it('single email sin coma', () => {
    expect(parseAdminEmails('solo@uno.com')).toEqual(['solo@uno.com']);
  });
});

describe('sendSintesisCompleta', () => {
  const baseArgs = {
    to: ['admin@vertice.app'],
    razon_social: 'Banco Demo Vertice SA',
    sesion_id: '11111111-1111-1111-1111-111111111111',
    perfil_id: '22222222-2222-2222-2222-222222222222',
    pdf_url: 'https://blob.vercel-storage.com/sintesis/abc.pdf',
    completitud: 0.85,
    confianza_global: 0.78,
    cajas_llenas: 42,
    cajas_aplicables: 49,
    app_url: 'http://localhost:3000',
  };

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    // Necesario para que client() construya el Resend mock.
    process.env.RESEND_API_KEY = 'test_key_resend_unit_tests_min_10_chars';
  });

  it('llama Resend con shape correcto cuando hay pdf_url', async () => {
    await sendSintesisCompleta(baseArgs);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0]![0]!;
    expect(payload.to).toEqual(['admin@vertice.app']);
    expect(payload.subject).toBe(
      'Vértice · Síntesis lista: Banco Demo Vertice SA'
    );
    expect(payload.text).toContain('Completitud: 85%');
    expect(payload.text).toContain('Confianza global: 78%');
    expect(payload.text).toContain('42 de 49 cajas');
    expect(payload.text).toContain(
      '/admin/sesiones/11111111-1111-1111-1111-111111111111'
    );
    expect(payload.text).toContain(baseArgs.pdf_url);
    expect(payload.html).toContain('Descargar PDF');
    expect(payload.html).toContain(baseArgs.pdf_url);
  });

  it('omite link de PDF y muestra nota cuando pdf_url es null', async () => {
    await sendSintesisCompleta({ ...baseArgs, pdf_url: null });
    const payload = sendMock.mock.calls[0]![0]!;
    expect(payload.text).toContain(
      'PDF se generó pero no se subió al storage'
    );
    expect(payload.text).not.toContain('Descargar PDF');
    expect(payload.html).toContain('PDF generado pero no almacenado');
    expect(payload.html).not.toContain('Descargar PDF</a>');
  });

  it('soporta múltiples recipients', async () => {
    await sendSintesisCompleta({
      ...baseArgs,
      to: ['a@x.com', 'b@x.com', 'c@x.com'],
    });
    const payload = sendMock.mock.calls[0]![0]!;
    expect(payload.to).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
  });

  it('throw si Resend retorna error', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        name: 'validation_error',
        message: 'Domain not verified',
      },
    });
    await expect(sendSintesisCompleta(baseArgs)).rejects.toThrow(
      /Resend rechazó el envío.*validation_error.*Domain not verified/
    );
  });

  it('throw temprano si to está vacío (defensa)', async () => {
    await expect(
      sendSintesisCompleta({ ...baseArgs, to: [] })
    ).rejects.toThrow(/al menos un recipient/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('escapa HTML en razon_social para prevenir XSS en preview', async () => {
    await sendSintesisCompleta({
      ...baseArgs,
      razon_social: 'Hack <script>alert(1)</script> SA',
    });
    const payload = sendMock.mock.calls[0]![0]!;
    expect(payload.html).not.toContain('<script>alert(1)</script>');
    expect(payload.html).toContain('&lt;script&gt;');
  });

  it('normaliza app_url con trailing slash', async () => {
    await sendSintesisCompleta({
      ...baseArgs,
      app_url: 'http://localhost:3000/',
    });
    const payload = sendMock.mock.calls[0]![0]!;
    // No debe quedar `//admin`
    expect(payload.text).toContain('http://localhost:3000/admin/sesiones/');
    expect(payload.text).not.toContain('localhost:3000//admin');
  });

  it('redondea porcentajes (Math.round)', async () => {
    await sendSintesisCompleta({
      ...baseArgs,
      completitud: 0.857,
      confianza_global: 0.504,
    });
    const payload = sendMock.mock.calls[0]![0]!;
    expect(payload.text).toContain('Completitud: 86%');
    expect(payload.text).toContain('Confianza global: 50%');
  });
});
