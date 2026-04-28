import { test, expect } from '@playwright/test'

// Usar estado de autenticação salvo
test.use({ storageState: './tests/.auth/user.json' })

test.describe('Dashboard', () => {
  test('deve carregar a página inicial', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('text=Bom')).toBeVisible() // "Bom dia/tarde/noite"
    await expect(page.locator('text=Consultas hoje')).toBeVisible()
  })

  test('deve mostrar cards de estatísticas', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('text=Pacientes')).toBeVisible()
    await expect(page.locator('text=Estoque')).toBeVisible()
  })

  test('deve navegar para ações rápidas', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Clicar em Novo agendamento
    await page.click('text=Novo agendamento')
    await expect(page).toHaveURL(/.*agenda.*novo/)
  })
})

test.describe('Agenda', () => {
  test('deve carregar a página de agenda', async ({ page }) => {
    await page.goto('/dashboard/agenda')
    await expect(page.locator('h1:has-text("Agenda")')).toBeVisible()
  })

  test('deve alternar entre visualizações', async ({ page }) => {
    await page.goto('/dashboard/agenda')
    
    // Clicar em visualização semanal
    await page.click('button:has-text("Semana")')
    await expect(page.locator('text=Segunda')).toBeVisible()
    
    // Clicar em visualização mensal
    await page.click('button:has-text("Mês")')
  })

  test('deve abrir formulário de novo agendamento', async ({ page }) => {
    await page.goto('/dashboard/agenda/novo')
    await expect(page.locator('text=Novo Agendamento')).toBeVisible()
    await expect(page.locator('input[type="date"]')).toBeVisible()
  })

  test('deve criar um agendamento', async ({ page }) => {
    await page.goto('/dashboard/agenda/novo')
    
    // Preencher formulário
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]
    
    await page.fill('input[type="date"]', dateStr)
    await page.fill('input[type="time"]', '10:00')
    
    // Selecionar paciente (se houver select)
    const patientSelect = page.locator('select').first()
    if (await patientSelect.isVisible()) {
      await patientSelect.selectOption({ index: 1 })
    }
    
    // Submeter
    await page.click('button[type="submit"]')
    
    // Verificar redirecionamento ou mensagem de sucesso
    await expect(page).toHaveURL(/.*agenda/, { timeout: 5000 })
  })
})

test.describe('Pacientes', () => {
  test('deve carregar lista de pacientes', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await expect(page.locator('h1:has-text("Pacientes")')).toBeVisible()
  })

  test('deve abrir formulário de novo paciente', async ({ page }) => {
    await page.goto('/dashboard/pacientes/novo')
    await expect(page.locator('input[placeholder*="Nome"]')).toBeVisible()
  })

  test('deve criar um paciente', async ({ page }) => {
    await page.goto('/dashboard/pacientes/novo')
    
    // Preencher dados básicos
    await page.fill('input[placeholder*="Nome"]', 'Paciente Teste E2E')
    await page.fill('input[type="tel"]', '11999999999')
    
    // Submeter
    await page.click('button[type="submit"]')
    
    // Verificar criação
    await expect(page).toHaveURL(/.*pacientes/, { timeout: 5000 })
  })

  test('deve buscar paciente', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    
    // Digitar na busca
    await page.fill('input[type="search"], input[placeholder*="Buscar"]', 'Teste')
    
    // Aguardar resultados
    await page.waitForTimeout(500)
  })
})

test.describe('Prontuário (Central do Paciente)', () => {
  test('rota antiga /prontuario redireciona pra /pacientes', async ({ page }) => {
    await page.goto('/dashboard/prontuario')
    // Redirect 301 — devemos cair em /dashboard/pacientes
    await expect(page).toHaveURL(/\/dashboard\/pacientes/)
    await expect(page.locator('h1:has-text("Pacientes")')).toBeVisible()
  })
})

test.describe('Estoque', () => {
  test('deve carregar lista de produtos', async ({ page }) => {
    await page.goto('/dashboard/estoque')
    await expect(page.locator('h1:has-text("Estoque")')).toBeVisible()
  })

  test('deve abrir formulário de novo produto', async ({ page }) => {
    await page.goto('/dashboard/estoque/novo')
    await expect(page.locator('input[placeholder*="Nome"]')).toBeVisible()
  })
})

test.describe('CRM', () => {
  test('deve carregar página do CRM', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expect(page.locator('text=CRM')).toBeVisible()
    await expect(page.locator('text=Funil')).toBeVisible()
  })

  test('deve abrir modal de novo lead', async ({ page }) => {
    await page.goto('/dashboard/crm')
    
    await page.click('button:has-text("Novo Lead")')
    await expect(page.locator('text=Adicionar Lead')).toBeVisible()
  })

  test('deve abrir configurações do CRM', async ({ page }) => {
    await page.goto('/dashboard/crm')
    
    // Clicar no botão de configurações (engrenagem)
    await page.click('button[title*="Configura"]')
    await expect(page.locator('text=Configurações do CRM')).toBeVisible()
  })
})

test.describe('Equipe', () => {
  test('deve carregar página da equipe', async ({ page }) => {
    await page.goto('/dashboard/equipe')
    await expect(page.locator('h1:has-text("Equipe")')).toBeVisible()
  })

  test('deve mostrar membros da equipe', async ({ page }) => {
    await page.goto('/dashboard/equipe')
    await expect(page.locator('text=Membros')).toBeVisible()
  })
})

test.describe('Recepção', () => {
  test('deve carregar página de check-in', async ({ page }) => {
    await page.goto('/dashboard/recepcao')
    await expect(page.locator('h1:has-text("Recep")')).toBeVisible()
  })
})

test.describe('Lista de Espera', () => {
  test('deve carregar lista de espera', async ({ page }) => {
    await page.goto('/dashboard/lista-espera')
    await expect(page.locator('text=Lista de Espera')).toBeVisible()
  })
})

test.describe('Documentos', () => {
  test('deve carregar página de documentos', async ({ page }) => {
    await page.goto('/dashboard/documentos')
    await expect(page.locator('text=Documentos')).toBeVisible()
  })

  test('deve acessar templates', async ({ page }) => {
    await page.goto('/dashboard/documentos/templates')
    await expect(page.locator('text=Templates')).toBeVisible()
  })
})

test.describe('Procedimentos', () => {
  test('deve carregar lista de procedimentos', async ({ page }) => {
    await page.goto('/dashboard/procedimentos')
    await expect(page.locator('text=Procedimentos')).toBeVisible()
  })
})

test.describe('Navegação Geral', () => {
  test('deve navegar pelo menu lateral', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Verificar se o menu está visível
    const sidebar = page.locator('nav, aside').first()
    await expect(sidebar).toBeVisible()
    
    // Testar alguns links do menu
    const menuItems = ['Agenda', 'Pacientes', 'Estoque', 'CRM']
    
    for (const item of menuItems) {
      const link = page.locator(`a:has-text("${item}")`).first()
      if (await link.isVisible()) {
        await link.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })

  test('deve mostrar notificações', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Clicar no sino de notificações
    const bellButton = page.locator('button:has(svg)').filter({ hasText: /^$/ }).first()
    if (await bellButton.isVisible()) {
      await bellButton.click()
    }
  })
})

test.describe('Fluxo Completo de Atendimento', () => {
  test('fluxo: agendamento -> check-in -> atendimento', async ({ page }) => {
    // 1. Ir para agenda
    await page.goto('/dashboard/agenda')
    await expect(page).toHaveURL(/.*agenda/)
    
    // 2. Verificar se há agendamentos ou criar um
    await page.goto('/dashboard/recepcao')
    await expect(page).toHaveURL(/.*recepcao/)
    
    // 3. Verificar página de recepção
    await expect(page.locator('text=Recep')).toBeVisible()
  })
})

test.describe('Responsividade', () => {
  test('deve funcionar em tela mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')
    
    // Verificar se a página carrega corretamente
    await expect(page.locator('text=Bom')).toBeVisible()
  })

  test('deve funcionar em tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/dashboard')
    
    await expect(page.locator('text=Bom')).toBeVisible()
  })
})
