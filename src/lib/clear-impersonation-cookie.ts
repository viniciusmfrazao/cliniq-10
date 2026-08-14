// Remove o cookie 'clinike-impersonating' (client-side, httpOnly: false).
// Deve ser chamado em qualquer login ou logout normal, para que uma sessão
// de impersonação anterior (ativada por um super admin em /admin/clinics)
// nunca vaze visualmente pro banner numa sessão seguinte que não tem nada
// a ver com ela. O cookie tem maxAge de 12h e só era limpo antes ao clicar
// em "Voltar pro admin" (/api/admin/impersonate/stop) — login/logout comuns
// não passavam por ali.
export function clearImpersonationCookie() {
  if (typeof document === 'undefined') return
  document.cookie = 'clinike-impersonating=; Max-Age=0; path=/'
}
