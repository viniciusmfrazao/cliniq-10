// ============================================================
// TESTE 01 — LANDING (clinike.com.br)
// ============================================================
// 100% seguro de rodar a qualquer momento. A landing é HTML
// estático servido pela CDN da Vercel — você está testando o
// edge da Vercel, não o seu sistema. Boas práticas:
//
//  - Smoke (1 min, baixa carga): valida que tá tudo no ar
//  - Load (3 min): performance em uso normal
//  - Stress (5 min ramp-up): até onde aguenta
//  - Spike (30s pico): sobrevivência a campanha viral
//
// Como rodar:
//   k6 run stress-test/01-landing.js                  (smoke)
//   k6 run --env STAGE=load   stress-test/01-landing.js
//   k6 run --env STAGE=stress stress-test/01-landing.js
//   k6 run --env STAGE=spike  stress-test/01-landing.js
//   k6 run --env STAGE=all    stress-test/01-landing.js
// ============================================================
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.LANDING_URL || 'https://clinike.com.br';
const STAGE = (__ENV.STAGE || 'smoke').toLowerCase();

const errorRate = new Rate('landing_errors');
const ttfb = new Trend('landing_ttfb_ms', true);

const STAGES = {
  smoke: [
    { duration: '20s', target: 5 },
    { duration: '40s', target: 5 },
  ],
  load: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 400 },
    { duration: '1m', target: 0 },
  ],
  spike: [
    { duration: '10s', target: 50 },
    { duration: '30s', target: 800 },
    { duration: '30s', target: 800 },
    { duration: '30s', target: 50 },
    { duration: '20s', target: 0 },
  ],
  all: [
    { duration: '20s', target: 10 },
    { duration: '40s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '20s', target: 600 },
    { duration: '40s', target: 50 },
    { duration: '20s', target: 0 },
  ],
};

export const options = {
  stages: STAGES[STAGE] || STAGES.smoke,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    landing_errors: ['rate<0.01'],
    landing_ttfb_ms: ['p(95)<300'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  group('Landing — homepage', () => {
    const res = http.get(BASE, {
      headers: { 'User-Agent': 'k6-stress-test (clinike-landing)' },
      tags: { route: 'home' },
    });
    const ok = check(res, {
      'status 200': (r) => r.status === 200,
      'tem html': (r) => (r.body || '').includes('<title>'),
      'tem clinike': (r) => (r.body || '').toLowerCase().includes('clinike'),
    });
    errorRate.add(!ok);
    if (res.timings) ttfb.add(res.timings.waiting);
  });

  group('Landing — assets', () => {
    const imgs = [
      `${BASE}/images/dashboard-mockup.png`,
      `${BASE}/images/agenda-mockup.png`,
      `${BASE}/images/mobile-mockup.png`,
    ];
    const responses = http.batch(imgs.map((u) => ['GET', u, null, { tags: { route: 'asset' } }]));
    responses.forEach((r) => {
      const ok = check(r, { 'asset 200/304': (x) => x.status === 200 || x.status === 304 });
      errorRate.add(!ok);
    });
  });

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const fmt = (v) => (v == null ? '-' : `${v.toFixed(0)}ms`);
  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════╗',
    `║  LANDING STRESS TEST — STAGE: ${STAGE.toUpperCase().padEnd(28)}║`,
    '╚════════════════════════════════════════════════════════════╝',
    `  URL                 : ${BASE}`,
    `  Iterations          : ${m.iterations?.values?.count ?? 0}`,
    `  Requests total      : ${m.http_reqs?.values?.count ?? 0}`,
    `  Erros               : ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    `  Latência p50        : ${fmt(m.http_req_duration?.values?.med)}`,
    `  Latência p95        : ${fmt(m.http_req_duration?.values?.['p(95)'])}`,
    `  Latência p99        : ${fmt(m.http_req_duration?.values?.['p(99)'])}`,
    `  Latência max        : ${fmt(m.http_req_duration?.values?.max)}`,
    `  TTFB p95 (waiting)  : ${fmt(m.landing_ttfb_ms?.values?.['p(95)'])}`,
    `  Throughput          : ${(m.http_reqs?.values?.rate ?? 0).toFixed(1)} req/s`,
    '',
  ];
  const out = {};
  out.stdout = lines.join('\n') + '\n';
  out['./stress-test/results/landing-' + STAGE + '.json'] = JSON.stringify(data, null, 2);
  return out;
}
