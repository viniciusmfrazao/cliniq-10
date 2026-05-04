// Diagnostico rapido pra ver status de cada endpoint
import http from 'k6/http';

export const options = { vus: 1, iterations: 1, thresholds: {} };

const BASE = __ENV.SYSTEM_URL || 'https://app.clinike.com.br';

export default function () {
  const urls = [
    '/',
    '/login',
    '/esqueci-senha',
    '/dashboard',
  ];
  console.log('\n=== DIAGNOSTICO ENDPOINTS ===\n');
  urls.forEach((path) => {
    const res = http.get(BASE + path, { redirects: 0, timeout: '10s' });
    console.log(
      String(res.status).padEnd(4) +
        ' | ' +
        String(res.timings.duration.toFixed(0) + 'ms').padEnd(8) +
        ' | ' +
        path
    );
  });
}
