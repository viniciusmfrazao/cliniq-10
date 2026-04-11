# Testes Automatizados - Cliniq

Este projeto usa **Playwright** para testes end-to-end (E2E).

## Instalação

```bash
# Instalar Playwright
npm install -D @playwright/test

# Instalar navegadores
npx playwright install
```

## Configuração

Crie um arquivo `.env.test` na raiz com suas credenciais de teste:

```env
TEST_EMAIL=seu-email@teste.com
TEST_PASSWORD=sua-senha
TEST_URL=http://localhost:3000
```

## Executar Testes

```bash
# Rodar todos os testes
npx playwright test

# Rodar com interface visual
npx playwright test --ui

# Rodar um teste específico
npx playwright test full-system.spec.ts

# Ver relatório após os testes
npx playwright show-report
```

## O que os testes cobrem

### Dashboard
- ✅ Carregamento da página inicial
- ✅ Cards de estatísticas
- ✅ Ações rápidas

### Agenda
- ✅ Visualização dia/semana/mês
- ✅ Criar agendamento
- ✅ Navegação entre datas

### Pacientes
- ✅ Lista de pacientes
- ✅ Criar novo paciente
- ✅ Busca de pacientes

### Prontuário
- ✅ Carregamento da página

### Estoque
- ✅ Lista de produtos
- ✅ Formulário de novo produto

### CRM
- ✅ Visualização Kanban
- ✅ Criar novo lead
- ✅ Configurações do CRM

### Equipe
- ✅ Lista de membros
- ✅ Gestão de permissões

### Recepção
- ✅ Check-in de pacientes

### Documentos
- ✅ Lista de documentos
- ✅ Templates

### Responsividade
- ✅ Tela mobile (375px)
- ✅ Tela tablet (768px)

## Estrutura

```
tests/
├── .auth/           # Estado de autenticação salvo
├── auth.setup.ts    # Login automático
├── full-system.spec.ts  # Testes principais
└── README.md
```

## Dicas

- Os testes salvam screenshots quando falham
- Use `--ui` para depurar visualmente
- Configure `TEST_URL` para testar em produção
