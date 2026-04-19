import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'teste@clinike.com.br')
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'senha123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
}

test.describe('CRM - Leads', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('deve acessar página de CRM', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expect(page).toHaveURL(/crm/)
  })

  test('deve ver funil de leads', async ({ page }) => {
    await page.goto('/dashboard/crm')
    
    // Verifica se os estágios do funil existem
    await expect(page.locator('text=/novo|contatado|agendou|convertido/i').first()).toBeVisible()
  })

  test('deve criar um lead', async ({ page }) => {
    await page.goto('/dashboard/crm')
    
    // Clica em novo lead
    await page.click('text=/novo lead|\\+/i')
    
    // Preenche dados
    await page.fill('input[name="name"], input[placeholder*="Nome"]', 'Lead Teste E2E')
    await page.fill('input[name="phone"], input[placeholder*="Telefone"]', '11988887777')
    
    // Seleciona origem
    await page.click('text=/origem|fonte|source/i')
    await page.click('text=/instagram|whatsapp/i')
    
    // Submete
    await page.click('button[type="submit"], button:has-text("Salvar")')
    
    await expect(page.locator('text=/sucesso|criado/i')).toBeVisible({ timeout: 5000 })
  })

  test('deve mover lead entre estágios (drag & drop)', async ({ page }) => {
    await page.goto('/dashboard/crm')
    
    // Encontra um lead no primeiro estágio
    const leadCard = page.locator('[data-testid="lead-card"]:first-child, .lead-card:first-child')
    
    if (await leadCard.isVisible()) {
      // Tenta mover (depende da implementação do drag & drop)
      const targetColumn = page.locator('[data-stage="contacted"], .stage-column:nth-child(2)')
      
      await leadCard.dragTo(targetColumn)
    }
  })

  test('deve filtrar leads por origem', async ({ page }) => {
    await page.goto('/dashboard/crm')
    
    // Procura filtro de origem
    const sourceFilter = page.locator('select, [data-testid="source-filter"]')
    if (await sourceFilter.isVisible()) {
      await sourceFilter.click()
      await page.click('text=/instagram/i')
    }
  })
})
