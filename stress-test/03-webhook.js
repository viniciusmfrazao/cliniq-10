// ============================================================
// TESTE 03 — WEBHOOK WHATSAPP (Evolution API)
// ============================================================
// ⚠️ ATENÇÃO — TESTE INVASIVO
// Esse teste DISPARA mensagens reais no webhook do seu sistema.
// Cada mensagem pode:
//   - Criar lead novo (telefone fake)
//   - Ativar a Eva (custo na API do Claude por mensagem!)
//   - Aparecer no CRM do operador
//
// COMO USAR COM SEGURANÇA:
//   1. Tenha uma instância de TESTE separada da de produção
//   2. Use INSTANCE/TOKEN dessa instância de teste
//   3. Antes do teste, desative a Eva (modo manual) ou use
//      telefones que a Eva já reconhece como "ignorar"
//   4. Após o teste, limpe os leads gerados (use a query
//      em SAFETY.md)
//
// COMO RODAR:
//   $env:WEBHOOK_INSTANCE="evolution-test"
//   $env:WEBHOOK_TOKEN="seu-token-da-instancia-de-teste"
//   k6 run stress-test/03-webhook.js                    (smoke)
//   k6 run --env STAGE=load   stress-test/03-webhook.js
// ============================================================
import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { buildEvolutionMessageBody, randomPhone } from './lib/data.js';

const BASE = __ENV.SYSTEM_URL || 'https://app.clinike.com.br';
const INSTANCE = __ENV.WEBHOOK_INSTANCE || '';
const TOKEN = __ENV.WEBHOOK_TOKEN || '';
const STAGE = (__ENV.STAGE || 'smoke').toLowerCase();
const FORCE = __ENV.FORCE === 'true';

if (!INSTANCE || !TOKEN) {
  console.error('❌ Variáveis WEBHOOK_INSTANCE e WEBHOOK_TOKEN são obrigatórias.');
  console.error('   Veja stress-test/README.md → "Webhook test"');
  fail('missing env');
}

if (!FORCE && STAGE !== 'smoke') {
  console.error('⚠️  Para rodar STAGE=' + STAGE + ' contra webhook real, defina FORCE=true.');
  console.error('   Confirma que entendeu os custos (Eva/Claude) e dados que serão criados.');
  fail('confirmation needed');
}

const errors = new Rate('webhook_errors');
const respTime = new Trend('webhook_response_ms', true);
const sent = new Counter('webhook_messages_sent');

const STAGES = {
  smoke: [
    { duration: '20s', target: 1 },
    { duration: '20s', target: 1 },
  ],
  load: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 50 },
    { duration: '30s', target: 0 },
  ],
  spike: [
    { duration: '10s', target: 2 },
    { duration: '20s', target: 50 },
    { duration: '30s', target: 50 },
    { duration: '20s', target: 0 },
  ],
};

export const options = {
  stages: STAGES[STAGE] || STAGES.smoke,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000', 'p(99)<8000'],
    webhook_errors: ['rate<0.05'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  group('Webhook — message upsert', () => {
    const phone = randomPhone();
    const body = buildEvolutionMessageBody(INSTANCE, { phone });
    const url = `${BASE}/api/webhooks/evolution/${encodeURIComponent(INSTANCE)}?token=${encodeURIComponent(TOKEN)}`;

    const res = http.post(url, body, {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'k6-stress-test (webhook)' },
      tags: { route: 'webhook' },
      timeout: '15s',
    });

    const ok = check(res, {
      'status 2xx': (r) => r.status >= 200 && r.status < 300,
    });
    errors.add(!ok);
    sent.add(1);
    if (res.timings) respTime.add(res.timings.duration);

    if (!ok && __VU === 1 && __ITER < 3) {
      console.warn(`Webhook erro: ${res.status} — ${(res.body || '').slice(0, 200)}`);
    }
  });

  // Espera entre msgs do mesmo VU pra não parecer bot único
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const fmt = (v) => (v == null ? '-' : `${v.toFixed(0)}ms`);
  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════╗',
    `║  WEBHOOK STRESS TEST — STAGE: ${STAGE.toUpperCase().padEnd(28)}║`,
    '╚════════════════════════════════════════════════════════════╝',
    `  Endpoint            : ${BASE}/api/webhooks/evolution/${INSTANCE}`,
    `  Mensagens enviadas  : ${m.webhook_messages_sent?.values?.count ?? 0}`,
    `  Erros               : ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    `  Resposta p50        : ${fmt(m.http_req_duration?.values?.med)}`,
    `  Resposta p95        : ${fmt(m.http_req_duration?.values?.['p(95)'])}`,
    `  Resposta p99        : ${fmt(m.http_req_duration?.values?.['p(99)'])}`,
    `  Resposta max        : ${fmt(m.http_req_duration?.values?.max)}`,
    `  Throughput          : ${(m.webhook_messages_sent?.values?.rate ?? 0).toFixed(1)} msg/s`,
    '',
    '  ⚠️  Lembre-se de limpar os leads de teste depois.',
    '     Veja stress-test/SAFETY.md',
    '',
  ];
  const out = {};
  out.stdout = lines.join('\n') + '\n';
  out['./stress-test/results/webhook-' + STAGE + '.json'] = JSON.stringify(data, null, 2);
  return out;
}
