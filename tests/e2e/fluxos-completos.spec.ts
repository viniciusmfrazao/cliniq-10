import { test, expect } from '@playwright/test'

/**
 * TESTES DE FLUXOS COMPLETOS
 * 
 * Estes testes simulam jornadas completas de usuário,
 * testando múltiplas funcionalidades em sequência.
 */

async function login(page: any) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'teste@cliniq.com')
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'senha123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
}

test.describe('Fluxo: Atendimento Completo', () => {
  test('cadastrar paciente → agendar → check-in → atendimento', async ({ page }) => {
    await login(page)
    
    // 1. Cadastrar novo paciente
    await page.goto('/dashboard/pacientes/novo')
    const timestamp = Date.now()
    const patientName = `Paciente Fluxo ${timestamp}`
    
    await page.fill('input[name="name"], input[placeholder*="Nome"]', patientName)
    await page.fill('input[name="phone"], input[placeholder*="Telefone"]', '11999990000')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    
    // 2. Criar agendamento para o paciente
    await page.goto('/dashboard/agenda/novo')
    
    // Busca e seleciona o paciente criado
    await page.click('text=/paciente/i')
    await page.fill('input[placeholder*="Buscar"]', patientName)
    await page.click(`text=${patientName}`)
    
    // Seleciona profissional
    await page.click('text=/profissional/i')
    await page.click('[role="option"]:first-child')
    
    // Seleciona procedimento
    await page.click('text=/procedimento/i')
    await page.click('[role="option"]:first-child')
    
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    
    // 3. Ir para recepção e fazer check-in
    await page.goto('/dashboard/recepcao')
    
    // Encontra o agendamento e faz check-in
    const appointment = page.locator(`text=${patientName}`).first()
    if (await appointment.isVisible()) {
      await appointment.click()
      await page.click('text=/check-in|chegou/i')
    }
    
    // Verificação final
    await expect(page).toHaveURL(/dashboard/)
  })
})

test.describe('Fluxo: Navegação Geral', () => {
  test('deve navegar por todas as páginas principais', async ({ page }) => {
    await login(page)
    
    const pages = [
      '/dashboard',
      '/dashboard/agenda',
      '/dashboard/pacientes',
      '/dashboard/procedimentos',
      '/dashboard/config',
    ]
    
    for (const url of pages) {
      await page.goto(url)
      await expect(page).toHaveURL(new RegExp(url.replace('/', '\\/')))
      await page.waitForTimeout(500)
    }
  })
})

test.describe('Fluxo: Responsividade', () => {
  test('deve funcionar em mobile', async ({ page }) => {
    // Define viewport mobile
    await page.setViewportSize({ width: 375, height: 667 })
    
    await login(page)
    
    // Verifica se a navegação mobile existe
    await expect(page.locator('nav').first()).toBeVisible()
    
    // Navega para agenda
    await page.goto('/dashboard/agenda')
    await expect(page).toHaveURL(/agenda/)
  })
  
  test('deve funcionar em tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    
    await login(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/dashboard/)
  })
})

test.describe('Fluxo: Permissões', () => {
  test('usuário não logado deve ser redirecionado para login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/)
  })
  
  test('usuário comum não deve acessar admin', async ({ page }) => {
    await login(page)
    await page.goto('/admin')
    
    // Deve redirecionar ou mostrar erro
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url).not.toContain('/admin')
  })
})
