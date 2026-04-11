import { test as setup, expect } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'teste@teste.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'teste123'

setup('autenticar usuário', async ({ page }) => {
  await page.goto('/login')
  
  // Preencher login
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  
  // Clicar no botão de entrar
  await page.click('button[type="submit"]')
  
  // Aguardar redirecionamento para dashboard
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
  
  // Salvar estado de autenticação
  await page.context().storageState({ path: './tests/.auth/user.json' })
})
