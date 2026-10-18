let sequence=0;
export function newId(prefix='user'): string {
  const random=globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${++sequence}`;
  return `${prefix}-${random}`;
}
export function assertSafeId(id:string): void {
  if(!/^[a-z0-9][a-z0-9._-]{0,199}$/i.test(id)||id.includes('..')||['constructor','prototype'].includes(id))throw new Error('Invalid preset or collection ID');
}
