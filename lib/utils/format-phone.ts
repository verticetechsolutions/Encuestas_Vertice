// Phone live-formatter — agrupa dígitos en estilo MX "52 33 2654 0178"
// (2-2-4-4). Tolerante a paste/typing/backspace; preserva cursor por conteo
// de dígitos (no por offset crudo) para que la inserción de espacios no
// "salte" la posición de edición.
//
// Uso: <input onInput={formatPhoneInput} ... /> en cualquier <input type="tel">.
// El backend recibe el string formateado tal cual; la validación liviana en
// Zod (TelefonoSchema) sólo cuenta dígitos, así que el espaciado no afecta.

/** Format raw input to MX phone style. Preserves leading `+` if present. */
export function formatPhoneMX(input: string): string {
  const hasPlus = input.trim().startsWith('+');
  const digits = input.replace(/\D/g, '').slice(0, 12);
  if (digits.length === 0) return hasPlus ? '+' : '';
  const parts: string[] = [];
  parts.push(digits.slice(0, Math.min(2, digits.length)));
  if (digits.length > 2) parts.push(digits.slice(2, Math.min(4, digits.length)));
  if (digits.length > 4) parts.push(digits.slice(4, Math.min(8, digits.length)));
  if (digits.length > 8) parts.push(digits.slice(8, 12));
  return (hasPlus ? '+' : '') + parts.join(' ');
}

/** onInput handler que formatea en vivo y restaura el cursor por conteo de
 *  dígitos. Pensado para input no-controlado (uncontrolled / defaultValue) —
 *  mutamos `input.value` directamente, lo cual persiste porque React no
 *  re-asigna value en cada render cuando no hay prop `value`. */
export function formatPhoneInput(
  e: React.FormEvent<HTMLInputElement>
): void {
  const input = e.currentTarget;
  const oldValue = input.value;
  const oldCursor = input.selectionStart ?? oldValue.length;

  // Cuántos dígitos (o '+') había antes del cursor → ese es el ancla.
  const beforeCursor = oldValue.slice(0, oldCursor);
  const digitsBeforeCursor = beforeCursor.replace(/[^\d+]/g, '').length;

  const formatted = formatPhoneMX(oldValue);
  if (formatted === oldValue) return;

  input.value = formatted;

  // Restaurar cursor: avanzar por el string formateado contando dígitos/`+`
  // hasta igualar el ancla, dejando el caret justo después.
  let newCursor = 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (seen >= digitsBeforeCursor) break;
    if (/[\d+]/.test(formatted[i])) seen++;
    newCursor = i + 1;
  }
  if (seen < digitsBeforeCursor) newCursor = formatted.length;
  input.setSelectionRange(newCursor, newCursor);
}
