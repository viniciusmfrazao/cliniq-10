import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'teste@clinike.com.br')
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'senha123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
}

test.describe('Pacientes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('deve acessar lista de pacientes', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await expect(page).toHaveURL(/pacientes/)
  })

  test('deve buscar paciente', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('Maria')
      await page.waitForTimeout(500)
    }
  })

  test('deve abrir formulário de novo paciente', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    
    await page.click('text=/novo|adicionar|\\+/i')
    await expect(page.locator('text=/novo paciente|cadastrar/i')).toBeVisible({ timeout: 5000 })
  })

  test('deve criar um paciente', async ({ page }) => {
    await page.goto('/dashboard/pacientes/novo')
    
    // Preenche dados obrigatórios
    await page.fill('input[name="name"], input[placeholder*="Nome"]', 'Paciente Teste E2E')
    await page.fill('input[name="phone"], input[placeholder*="Telefone"]', '11999998888')
    await page.fill('input[name="email"], input[placeholder*="Email"]', 'teste-e2e@email.com')
    
    // Submete
    await page.click('button[type="submit"], button:has-text("Salvar")')
    
    // Verifica sucesso
    await expect(page.locator('text=/sucesso|criado|cadastrado/i')).toBeVisible({ timeout: 5000 })
  })

  test('deve abrir ficha do paciente', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    
    // Clica no primeiro paciente da lista
    await page.click('tr:first-child td:first-child, [data-testid="patient-row"]:first-child')
    
    // Verifica se abriu a ficha
    await expect(page).toHaveURL(/pacientes\/[a-z0-9-]+/)
  })
})
