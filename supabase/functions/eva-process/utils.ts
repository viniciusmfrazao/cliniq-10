// ============================================================================
// Helpers puros (sanitização, datas, normalização)
// ============================================================================

export function sanitizeWhatsapp(t: string | null | undefined): string {
  if (!t) return '';
  return String(t)
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    // Remove negrito com asterisco (duplo ou simples) — decisao do cliente:
    // mesmo sendo o negrito real do WhatsApp, o uso constante deixa a
    // conversa com cara de mensagem automatica/IA. Rede de seguranca alem
    // da instrucao no prompt (regra critica 2), caso o modelo insista.
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\*/g, '')
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

/**
 * Avanca a data (ancorada em UTC) para o proximo dia util, se cair no fim de semana.
 */
export function pulaFimDeSemana(d: Date): Date {
  const day = d.getUTCDay();
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  return d;
}

/**
 * Pontuacao de match entre um texto livre e uma lista de procedimentos.
 * Mesma logica validada da CAMADA FOTO — extraida pra ser usada tanto pela
 * consultar_agenda quanto pela enviar_fotos_resultado (antes a agenda usava
 * um find() com includes bidirecional, que pegava o primeiro parecido e
 * puxava duracao/profissional errados em catalogos com nomes semelhantes).
 *
 * boostIds: ids que ganham um bonus de desempate (ex: quem tem foto cadastrada).
 */
export function matchProcedimento<T extends { id: string; name: string }>(
  texto: string,
  procedimentos: T[],
  opts?: { boostIds?: Set<string>; boost?: number },
): { item: T; score: number } | null {
  const alvo = norm(texto);
  if (!alvo) return null;

  const boostIds = opts?.boostIds;
  const boost = opts?.boost ?? 5;

  let melhor: T | null = null;
  let melhorScore = 0;

  for (const p of procedimentos) {
    const procNorm = norm(p.name);
    if (!procNorm) continue;
    const palavras = procNorm.split(/\s+/).filter((w) => w.length >= 4);
    if (palavras.length === 0) continue;

    let score = 0;
    if (alvo.includes(procNorm)) score += 100;
    const palavrasMatch = palavras.filter((w) => alvo.includes(w));
    score += palavrasMatch.length * 10;
    score += Math.round((palavrasMatch.length / palavras.length) * 20);
    if (score === 0) continue;
    if (boostIds?.has(p.id)) score += boost;

    if (score > melhorScore) {
      melhorScore = score;
      melhor = p;
    }
  }

  return melhor ? { item: melhor, score: melhorScore } : null;
}

/**
 * Parser livre de "periodo" — entrada do usuário em pt-BR.
 * Retorna { dataAlvo: 'YYYY-MM-DD', periodoAlvo: 'manha' | 'tarde' | null }
 *
 * IMPORTANTE (fuso): o runtime da Edge Function roda em UTC. Toda a aritmetica
 * de data e feita sobre uma ancora em UTC construida a partir da data-calendario
 * de Sao Paulo. Antes, o ramo dd/mm fazia `new Date(yy, mm-1, dd)` (meia-noite
 * UTC) e formatava em America/Sao_Paulo (UTC-3), o que devolvia SEMPRE o dia
 * anterior — "dia 05/08" virava 2026-08-04.
 */
export function parseData(texto: string): { dataAlvo: string; periodoAlvo: 'manha' | 'tarde' | null } {
  const tx = norm(texto);
  const tz = 'America/Sao_Paulo';

  // Data-calendario de HOJE em Sao Paulo (independente do fuso do runtime)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hojeY = Number(get('year'));
  const hojeM = Number(get('month'));
  const hojeD = Number(get('day'));
  const hojeIso = `${get('year')}-${get('month')}-${get('day')}`;

  // Ancora em UTC: meia-noite UTC do dia-calendario de SP. Toda aritmetica
  // (setUTCDate/getUTCDay) e o toISOString ficam consistentes entre si.
  const alvo = new Date(Date.UTC(hojeY, hojeM - 1, hojeD));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  let periodoAlvo: 'manha' | 'tarde' | null = null;
  if (/\bmanh[aã]\b/.test(tx)) periodoAlvo = 'manha';
  else if (/\btarde\b/.test(tx)) periodoAlvo = 'tarde';

  // dd/mm ou dd/mm/aaaa — montado como string, sem passar por Date local
  const dataMatch = tx.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dataMatch) {
    const dd = parseInt(dataMatch[1], 10);
    const mm = parseInt(dataMatch[2], 10);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      let yy: number;
      if (dataMatch[3]) {
        const raw = parseInt(dataMatch[3], 10);
        yy = raw < 100 ? 2000 + raw : raw;
      } else {
        yy = hojeY;
      }
      let candidato = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      // Sem ano explicito e data ja passou (ex: "dia 05/01" dito em dezembro) → ano que vem
      if (!dataMatch[3] && candidato < hojeIso) {
        candidato = `${yy + 1}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      }
      return { dataAlvo: candidato, periodoAlvo };
    }
  }

  if (tx.includes('hoje')) return { dataAlvo: hojeIso, periodoAlvo };

  // "dia 20", "no dia 5", "pro dia 28" — dia sem mes.
  //
  // Nao era tratado: caia no default (proximo dia util) e a paciente que pedia
  // o dia 20 recebia horario de amanha, sem nenhum aviso. Vem DEPOIS do ramo
  // dd/mm de proposito, pra "dia 15/09" continuar sendo lido como 15 de
  // setembro. Se o dia ja passou neste mes, assume o mes seguinte.
  const diaSoltoMatch = tx.match(/\bdia\s+(\d{1,2})\b/);
  if (diaSoltoMatch) {
    const dd = parseInt(diaSoltoMatch[1], 10);
    if (dd >= 1 && dd <= 31) {
      const montar = (y: number, m: number) =>
        `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      let candidato = montar(hojeY, hojeM);
      if (candidato < hojeIso) {
        const proxM = hojeM === 12 ? 1 : hojeM + 1;
        const proxY = hojeM === 12 ? hojeY + 1 : hojeY;
        candidato = montar(proxY, proxM);
      }
      // Valida que a data existe de fato (ex: "dia 31" em fevereiro)
      const [cy, cm, cd] = candidato.split('-').map(Number);
      const check = new Date(Date.UTC(cy, cm - 1, cd));
      if (check.getUTCDate() === cd && check.getUTCMonth() === cm - 1) {
        return { dataAlvo: candidato, periodoAlvo };
      }
    }
  }

  // "depois de amanha" ANTES de "amanha" — senao o includes('amanha') captura primeiro
  if (tx.includes('depois de amanha') || tx.includes('depois de amanhã')) {
    alvo.setUTCDate(alvo.getUTCDate() + 2);
    return { dataAlvo: iso(alvo), periodoAlvo };
  }

  if (tx.includes('amanha') || tx.includes('amanhã')) {
    alvo.setUTCDate(alvo.getUTCDate() + 1);
    return { dataAlvo: iso(alvo), periodoAlvo };
  }

  // Semana que vem → próxima segunda
  if (tx.includes('semana que vem') || tx.includes('proxima semana') || tx.includes('próxima semana')) {
    const day = alvo.getUTCDay();
    const daysUntilMonday = ((1 - day + 7) % 7) || 7;
    alvo.setUTCDate(alvo.getUTCDate() + daysUntilMonday);
    return { dataAlvo: iso(alvo), periodoAlvo };
  }

  // Essa semana → próximo dia útil
  if (tx.includes('essa semana') || tx.includes('esta semana')) {
    alvo.setUTCDate(alvo.getUTCDate() + 1);
    pulaFimDeSemana(alvo);
    return { dataAlvo: iso(alvo), periodoAlvo };
  }

  // Dia da semana
  const diasNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  for (let i = 0; i < diasNames.length; i++) {
    if (tx.includes(diasNames[i])) {
      const today = alvo.getUTCDay();
      let diff = (i - today + 7) % 7;
      if (diff === 0) diff = 7;
      alvo.setUTCDate(alvo.getUTCDate() + diff);
      return { dataAlvo: iso(alvo), periodoAlvo };
    }
  }

  // Default: próximo dia útil
  alvo.setUTCDate(alvo.getUTCDate() + 1);
  pulaFimDeSemana(alvo);
  return { dataAlvo: iso(alvo), periodoAlvo };
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
// deploy trigger Mon Jun  1 07:02:01 UTC 2026
