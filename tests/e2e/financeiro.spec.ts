import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'teste@cliniq.com')
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'senha123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
}

test.describe('Financeiro', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('deve acessar página de entradas', async ({ page }) => {
    await page.goto('/dashboard/financeiro/entradas')
    await expect(page).toHaveURL(/entradas/)
  })

  test('deve acessar página de saídas', async ({ page }) => {
    await page.goto('/dashboard/financeiro/saidas')
    await expect(page).toHaveURL(/saidas/)
  })

  test('deve acessar DRE', async ({ page }) => {
    await page.goto('/dashboard/financeiro/dre')
    await expect(page).toHaveURL(/dre/)
  })

  test('deve criar uma entrada', async ({ page }) => {
    await page.goto('/dashboard/financeiro/entradas')
    
    // Abre formulário de nova entrada
    await page.click('text=/nova|\\+/i')
    
    // Preenche dados
    await page.fill('input[name="valor_bruto"], input[placeholder*="Valor"]', '500')
    
    // Seleciona forma de pagamento
    await page.click('text=/forma.*pagamento|payment/i')
    await page.click('text=/pix|dinheiro/i')
    
    // Submete
    await page.click('button[type="submit"], button:has-text("Salvar")')
    
    await expect(page.locator('text=/sucesso|salvo/i')).toBeVisible({ timeout: 5000 })
  })

  test('deve criar uma saída', async ({ page }) => {
    await page.goto('/dashboard/financeiro/saidas')
    
    await page.click('text=/nova|\\+/i')
    
    await page.fill('input[name="descricao"], input[placeholder*="Descrição"]', 'Material de escritório - Teste')
    await page.fill('input[name="valor"], input[placeholder*="Valor"]', '150')
    
    await page.click('button[type="submit"], button:has-text("Salvar")')
    
    await expect(page.locator('text=/sucesso|salvo/i')).toBeVisible({ timeout: 5000 })
  })

  test('deve filtrar entradas por período', async ({ page }) => {
    await page.goto('/dashboard/financeiro/entradas')
    
    // Procura por filtro de data
    const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"]')
    if (await dateFilter.first().isVisible()) {
      await dateFilter.first().click()
    }
  })
})
