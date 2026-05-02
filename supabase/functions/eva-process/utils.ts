// ============================================================================
// Helpers puros (sanitização, datas, normalização)
// ============================================================================

export function sanitizeWhatsapp(t: string | null | undefined): string {
  if (!t) return '';
  return String(t)
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function norm(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function formatBRL(v: number | null | undefined): string | null {
  if (v == null || isNaN(v as number)) return null;
  return Number(v).toFixed(2).replace('.', ',');
}

export function pulaFimDeSemana(d: Date): Date {
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1);
  if (day === 6) d.setDate(d.getDate() + 2);
  return d;
}

/**
 * Parser livre de "periodo" — entrada do usuário em pt-BR.
 * Retorna { dataAlvo: 'YYYY-MM-DD', periodoAlvo: 'manha' | 'tarde' | null }
 */
export function parseData(texto: string): { dataAlvo: string; periodoAlvo: 'manha' | 'tarde' | null } {
  const tx = norm(texto);
  const tz = 'America/Sao_Paulo';
  const fmt = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };

  const now = new Date();
  let alvo = new Date(now);

  let periodoAlvo: 'manha' | 'tarde' | null = null;
  if (/\bmanh[aã]\b/.test(tx)) periodoAlvo = 'manha';
  else if (/\btarde\b/.test(tx)) periodoAlvo = 'tarde';

  // dd/mm ou dd/mm/aaaa
  const dataMatch = tx.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dataMatch) {
    const dd = parseInt(dataMatch[1], 10);
    const mm = parseInt(dataMatch[2], 10);
    const yy = dataMatch[3] ? parseInt(dataMatch[3], 10) : now.getFullYear();
    alvo = new Date(yy < 100 ? 2000 + yy : yy, mm - 1, dd);
    return { dataAlvo: fmt(alvo), periodoAlvo };
  }

  if (tx.includes('hoje')) return { dataAlvo: fmt(now), periodoAlvo };

  if (tx.includes('amanha') || tx.includes('amanhã')) {
    alvo.setDate(alvo.getDate() + 1);
    return { dataAlvo: fmt(alvo), periodoAlvo };
  }

  // Semana que vem → próxima segunda
  if (tx.includes('semana que vem') || tx.includes('proxima semana') || tx.includes('próxima semana')) {
    const day = alvo.getDay();
    const daysUntilMonday = ((1 - day + 7) % 7) || 7;
    alvo.setDate(alvo.getDate() + daysUntilMonday);
    return { dataAlvo: fmt(alvo), periodoAlvo };
  }

  // Essa semana → próximo dia útil
  if (tx.includes('essa semana') || tx.includes('esta semana')) {
    alvo.setDate(alvo.getDate() + 1);
    alvo = pulaFimDeSemana(alvo);
    return { dataAlvo: fmt(alvo), periodoAlvo };
  }

  // Dia da semana
  const diasNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  for (let i = 0; i < diasNames.length; i++) {
    if (tx.includes(diasNames[i])) {
      const today = alvo.getDay();
      let diff = (i - today + 7) % 7;
      if (diff === 0) diff = 7;
      alvo.setDate(alvo.getDate() + diff);
      return { dataAlvo: fmt(alvo), periodoAlvo };
    }
  }

  // Default: próximo dia útil
  alvo.setDate(alvo.getDate() + 1);
  alvo = pulaFimDeSemana(alvo);
  return { dataAlvo: fmt(alvo), periodoAlvo };
}

export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return '(data desconhecida)';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  return `${dias[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * Faz request com retries leves pra erros transitórios.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { retries?: number } = {},
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const retries = init.retries ?? 1;
  let lastErr: string | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, init);
      const text = await r.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      if (!r.ok) {
        return { ok: false, status: r.status, data: parsed as T, error: typeof parsed === 'string' ? parsed : JSON.stringify(parsed).slice(0, 300) };
      }
      return { ok: true, status: r.status, data: parsed as T };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  return { ok: false, status: 0, data: null, error: lastErr ?? 'fetch failed' };
}
