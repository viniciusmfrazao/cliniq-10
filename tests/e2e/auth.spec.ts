import { test, expect } from '@playwright/test'

// Dados de teste - ALTERE PARA SUAS CREDENCIAIS DE TESTE
const TEST_USER = {
  email: 'teste@clinike.com.br',
  password: 'senha123'
}

test.describe('Autenticação', () => {
  test('deve mostrar página de login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1, h2').first()).toContainText(/login|entrar/i)
  })

  test('deve fazer login com sucesso', async ({ page }) => {
    await page.goto('/login')
    
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    
    // Aguarda redirecionamento para dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
  })

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/login')
    
    await page.fill('input[type="email"]', 'invalido@teste.com')
    await page.fill('input[type="password"]', 'senhaerrada')
    await page.click('button[type="submit"]')
    
    // Deve mostrar mensagem de erro
    await expect(page.locator('text=/erro|inválid|incorrect/i')).toBeVisible({ timeout: 5000 })
  })

  test('deve fazer logout', async ({ page }) => {
    // Primeiro faz login
    await page.goto('/login')
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
    
    // Clica no botão de logout
    await page.click('[title="Sair"], button:has-text("Sair")')
    
    // Deve voltar para login
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})
