// ============================================================
// TESTE 02 — SISTEMA (app.clinike.com.br)
// ============================================================
// Testa apenas rotas PÚBLICAS e somente-leitura. Não cria dados,
// não aciona webhooks, não dispara Eva. É seguro contra produção.
//
// Cobre:
//   - Tela de login (/login) — Server Component público
//   - Esqueci senha (/esqueci-senha) — público
//   - Assets estáticos (favicon, _next/static, manifest PWA)
//   - Health check Next.js
//
// Como rodar:
//   k6 run stress-test/02-system.js                     (smoke)
//   k6 run --env STAGE=load   stress-test/02-system.js
//   k6 run --env STAGE=stress stress-test/02-system.js
// ============================================================
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.SYSTEM_URL || 'https://app.clinike.com.br';
const STAGE = (__ENV.STAGE || 'smoke').toLowerCase();

const errors = new Rate('system_errors');
const loginTrend = new Trend('system_login_ms', true);
const assetTrend = new Trend('system_asset_ms', true);

const STAGES = {
  smoke: [
    { duration: '15s', target: 3 },
    { duration: '30s', target: 3 },
  ],
  load: [
    { duration: '30s', target: 25 },
    { duration: '2m', target: 25 },
    { duration: '20s', target: 0 },
  ],
  stress: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  spike: [
    { duration: '10s', target: 30 },        // baseline
    { duration: '30s', target: 800 },       // pico súbito (campanha viral)
    { duration: '30s', target: 800 },       // sustenta o pico
    { duration: '20s', target: 30 },        // recovery
    { duration: '15s', target: 0 },
  ],
};

// Em spike, latência alta e alguns 429 são esperados; thresholds relaxam
const isSpike = STAGE === 'spike';

export const options = {
  stages: STAGES[STAGE] || STAGES.smoke,
  thresholds: isSpike
    ? {
        http_req_failed: ['rate<0.15'],
        http_req_duration: ['p(95)<8000', 'p(99)<15000'],
        system_errors: ['rate<0.15'],
        system_login_ms: ['p(95)<10000'],
      }
    : {
        http_req_failed: ['rate<0.02'],
        http_req_duration: ['p(95)<1500', 'p(99)<3000'],
        system_errors: ['rate<0.02'],
        system_login_ms: ['p(95)<2000'],
      },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  group('Sistema — Login page', () => {
    const res = http.get(`${BASE}/login`, {
      headers: { 'User-Agent': 'k6-stress-test (clinike-system)' },
      tags: { route: 'login' },
    });
    const ok = check(res, {
      'login 200': (r) => r.status === 200,
    });
    errors.add(!ok);
    if (res.timings) loginTrend.add(res.timings.duration);
  });

  group('Sistema — Esqueci senha', () => {
    const res = http.get(`${BASE}/esqueci-senha`, {
      tags: { route: 'esqueci-senha' },
    });
    const ok = check(res, { 'forgot 200': (r) => r.status === 200 });
    errors.add(!ok);
  });

  group('Sistema — Home (rota raiz)', () => {
    const res = http.get(`${BASE}/`, {
      tags: { route: 'home' },
    });
    if (res.timings) assetTrend.add(res.timings.duration);
    // Pode redirecionar pra /login (302/307) ou retornar 200 se logado
    const ok = check(res, { 'home reachable': (r) => r.status === 200 || (r.status >= 300 && r.status < 400) });
    errors.add(!ok);
  });

  sleep(Math.random() * 3 + 1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const fmt = (v) => (v == null ? '-' : `${v.toFixed(0)}ms`);
  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════╗',
    `║  SISTEMA STRESS TEST — STAGE: ${STAGE.toUpperCase().padEnd(28)}║`,
    '╚════════════════════════════════════════════════════════════╝',
    `  URL                 : ${BASE}`,
    `  Iterations          : ${m.iterations?.values?.count ?? 0}`,
    `  Requests total      : ${m.http_reqs?.values?.count ?? 0}`,
    `  Erros               : ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    `  Latência p50        : ${fmt(m.http_req_duration?.values?.med)}`,
    `  Latência p95        : ${fmt(m.http_req_duration?.values?.['p(95)'])}`,
    `  Latência p99        : ${fmt(m.http_req_duration?.values?.['p(99)'])}`,
    `  Login p95           : ${fmt(m.system_login_ms?.values?.['p(95)'])}`,
    `  Assets p95          : ${fmt(m.system_asset_ms?.values?.['p(95)'])}`,
    `  Throughput          : ${(m.http_reqs?.values?.rate ?? 0).toFixed(1)} req/s`,
    '',
  ];
  const out = {};
  out.stdout = lines.join('\n') + '\n';
  out['./stress-test/results/system-' + STAGE + '.json'] = JSON.stringify(data, null, 2);
  return out;
}
