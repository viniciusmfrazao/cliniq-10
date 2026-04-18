import { test, expect } from '@playwright/test'

// Helper para fazer login antes dos testes
async function login(page: any) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'teste@cliniq.com')
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'senha123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
}

test.describe('Agenda', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('deve acessar página da agenda', async ({ page }) => {
    await page.goto('/dashboard/agenda')
    await expect(page).toHaveURL(/agenda/)
    await expect(page.locator('text=/agenda|calendar/i').first()).toBeVisible()
  })

  test('deve abrir formulário de novo agendamento', async ({ page }) => {
    await page.goto('/dashboard/agenda')
    
    // Clica no botão de novo agendamento
    await page.click('text=/novo|agendar|\\+/i')
    
    // Verifica se o formulário apareceu
    await expect(page.locator('text=/novo agendamento|agendar/i')).toBeVisible({ timeout: 5000 })
  })

  test('deve alternar entre visualizações (dia/semana)', async ({ page }) => {
    await page.goto('/dashboard/agenda')
    
    // Procura botões de visualização
    const diaBtn = page.locator('button:has-text("Dia"), [data-view="day"]')
    const semanaBtn = page.locator('button:has-text("Semana"), [data-view="week"]')
    
    if (await semanaBtn.isVisible()) {
      await semanaBtn.click()
      await page.waitForTimeout(500)
    }
    
    if (await diaBtn.isVisible()) {
      await diaBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test('deve criar um agendamento', async ({ page }) => {
    await page.goto('/dashboard/agenda/novo')
    
    // Preenche o formulário (ajuste os seletores conforme sua UI)
    // Seleciona paciente
    await page.click('text=/paciente/i')
    await page.click('[role="option"]:first-child, li:first-child')
    
    // Seleciona profissional
    await page.click('text=/profissional/i')
    await page.click('[role="option"]:first-child, li:first-child')
    
    // Seleciona procedimento
    await page.click('text=/procedimento/i')
    await page.click('[role="option"]:first-child, li:first-child')
    
    // Submete o formulário
    await page.click('button[type="submit"], button:has-text("Salvar"), button:has-text("Agendar")')
    
    // Verifica sucesso
    await expect(page.locator('text=/sucesso|criado|agendado/i')).toBeVisible({ timeout: 5000 })
  })
})
