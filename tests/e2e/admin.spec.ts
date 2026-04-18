import { test, expect } from '@playwright/test'

// Super Admin credentials
const SUPER_ADMIN = {
  email: process.env.SUPER_ADMIN_EMAIL || 'viniciusmfrazao@gmail.com',
  password: process.env.SUPER_ADMIN_PASSWORD || 'senha123'
}

async function loginAsSuperAdmin(page: any) {
  await page.goto('/login')
  await page.fill('input[type="email"]', SUPER_ADMIN.email)
  await page.fill('input[type="password"]', SUPER_ADMIN.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
}

test.describe('Super Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('deve acessar painel admin', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/admin/)
    await expect(page.locator('text=/dashboard|super admin/i')).toBeVisible()
  })

  test('deve ver métricas no dashboard', async ({ page }) => {
    await page.goto('/admin')
    
    // Verifica se os cards de métricas existem
    await expect(page.locator('text=/clínicas/i')).toBeVisible()
    await expect(page.locator('text=/usuários/i')).toBeVisible()
  })

  test('deve acessar lista de clínicas', async ({ page }) => {
    await page.goto('/admin/clinics')
    await expect(page).toHaveURL(/admin\/clinics/)
  })

  test('deve abrir formulário de nova clínica', async ({ page }) => {
    await page.goto('/admin/clinics')
    
    await page.click('text=/nova clínica|\\+/i')
    await expect(page).toHaveURL(/admin\/clinics\/new/)
  })

  test('deve criar uma clínica', async ({ page }) => {
    await page.goto('/admin/clinics/new')
    
    const timestamp = Date.now()
    
    // Preenche dados da clínica
    await page.fill('input[placeholder*="Nome"], input:near(label:has-text("Nome"))', `Clínica Teste ${timestamp}`)
    
    // Preenche dados do admin
    await page.fill('input[placeholder*="Nome completo"]', 'Admin Teste')
    await page.fill('input[type="email"][placeholder*="admin"]', `admin${timestamp}@teste.com`)
    await page.fill('input[type="password"]', 'senha123456')
    
    // Submete
    await page.click('button[type="submit"], button:has-text("Criar")')
    
    // Verifica redirecionamento ou sucesso
    await page.waitForURL(/admin\/clinics\/[a-z0-9-]+/, { timeout: 10000 })
  })

  test('deve acessar página de planos', async ({ page }) => {
    await page.goto('/admin/plans')
    await expect(page).toHaveURL(/admin\/plans/)
  })

  test('deve criar um plano', async ({ page }) => {
    await page.goto('/admin/plans/new')
    
    const timestamp = Date.now()
    
    await page.fill('input[placeholder*="Nome"], input:near(label:has-text("Nome"))', `Plano Teste ${timestamp}`)
    await page.fill('input[type="number"]:first-of-type', '299')
    
    // Seleciona alguns módulos
    await page.click('text=Agenda')
    await page.click('text=Pacientes')
    
    // Submete
    await page.click('button[type="submit"], button:has-text("Criar")')
    
    // Verifica redirecionamento
    await page.waitForURL(/admin\/plans/, { timeout: 10000 })
  })

  test('deve acessar logs em tempo real', async ({ page }) => {
    await page.goto('/admin/logs')
    await expect(page).toHaveURL(/admin\/logs/)
    await expect(page.locator('text=/logs|atividade/i')).toBeVisible()
  })
})
