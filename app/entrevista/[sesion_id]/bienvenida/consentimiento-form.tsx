'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { registrarConsentimiento } from '@/app/actions/sesiones';

export function ConsentimientoForm({ sesion_id }: { sesion_id: string }) {
  const [aceptado, setAceptado] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onContinuar = () => {
    startTransition(async () => {
      await registrarConsentimiento(sesion_id);
      router.push(`/entrevista/${sesion_id}`);
    });
  };

  return (
    <div>
      <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 24, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={aceptado}
          onChange={(e) => setAceptado(e.target.checked)}
          style={{ marginTop: 4 }}
        />
        <span style={{ fontSize: 14, lineHeight: 1.5 }}>
          He leído el aviso de privacidad y otorgo mi consentimiento para que Vértice
          procese los datos de esta entrevista bajo los términos descritos.
        </span>
      </label>
      <button
        type="button"
        disabled={!aceptado || isPending}
        onClick={onContinuar}
        style={{
          padding: '12px 24px',
          fontSize: 15,
          fontWeight: 500,
          background: !aceptado || isPending ? '#999' : '#111',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: !aceptado || isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? 'Iniciando…' : 'Iniciar entrevista'}
      </button>
    </div>
  );
}
