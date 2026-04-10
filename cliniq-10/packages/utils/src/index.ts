export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function trialDaysLeft(trialEndsAt: string): number {
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
}

export function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR')
}
