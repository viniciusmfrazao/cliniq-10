# Prompt para Criar Site Institucional Clinike

Copie e cole este prompt no Claude para gerar o site:

---

## PROMPT:

```
Crie um site institucional moderno e campeão de vendas para o Clinike - um sistema SaaS completo para gestão de clínicas de estética.

## SOBRE O PRODUTO

**Clinike** é um sistema completo para clínicas de estética que inclui:

### Módulos Principais:
- 📅 **Agenda Inteligente** - Agendamentos com visualização por dia/semana/mês, múltiplos profissionais
- 👥 **Gestão de Pacientes** - Cadastro completo, histórico, anamneses digitais
- 💰 **Financeiro** - Controle de entradas, saídas, DRE, comissões
- 📦 **Estoque** - Controle de produtos, injetáveis, alertas de validade
- 📋 **Prontuário Eletrônico** - Evoluções, fotos antes/depois, marcação de pontos
- 🎯 **CRM** - Funil de leads, acompanhamento de conversões
- 📄 **Documentos** - Termos de consentimento com assinatura digital
- 🤖 **Donna IA** - Assistente de WhatsApp com IA para agendamentos automáticos
- 👩‍💼 **Recepção** - Check-in de pacientes, notificações para profissionais
- ⏰ **Lista de Espera** - Gestão de encaixes e oportunidades

### Diferenciais:
- 100% na nuvem, acesse de qualquer lugar
- Interface moderna e intuitiva
- Multi-clínica (ideal para franquias)
- Responsivo (funciona no celular)
- Sem instalação, sem manutenção
- Suporte humanizado via WhatsApp
- Integrações com WhatsApp Business
- Relatórios e dashboards em tempo real

### Planos:
- **Starter** - Para clínicas iniciantes (1-2 profissionais)
- **Professional** - Para clínicas em crescimento (até 5 profissionais)  
- **Enterprise** - Para clínicas grandes e franquias (ilimitado)

## REQUISITOS DO SITE

### Estrutura:
1. **Hero Section** - Impactante, com headline forte e CTA para WhatsApp
2. **Problema/Solução** - Dores das clínicas vs benefícios do Clinike
3. **Módulos** - Showcase visual de cada funcionalidade
4. **Screenshots** - Mockups do sistema (telas bonitas)
5. **Depoimentos** - Social proof (pode criar fictícios realistas)
6. **Planos e Preços** - Tabela comparativa
7. **FAQ** - Dúvidas frequentes
8. **CTA Final** - Chamada forte para WhatsApp
9. **Footer** - Contato, redes sociais

### Design:
- Cores: Violeta/Roxo (#8B5CF6, #7C3AED) como principal, com toques de verde para CTAs
- Estilo: Clean, moderno, muito espaço em branco
- Tipografia: Sans-serif moderna (Inter, Poppins)
- Elementos: Gradients sutis, cards com sombras, ícones modernos
- Mobile-first: Perfeito no celular

### CTAs:
- WhatsApp: https://wa.me/5534991805722
- Texto: "Falar com Especialista" ou "Começar Agora"

### Tom de Voz:
- Profissional mas acolhedor
- Focado em resultados e economia de tempo
- Entende as dores de quem gerencia clínica de estética

## TECNOLOGIA

Gere o código usando:
- Next.js 14 (App Router)
- Tailwind CSS
- Componentes React modernos
- Animações com Framer Motion (opcional)
- Imagens placeholder de https://placehold.co ou instruções para substituir

## ENTREGÁVEIS

1. Página completa `src/app/page.tsx` (landing page)
2. Componentes necessários em `src/components/landing/`
3. Instruções para imagens/assets necessários

Comece gerando a estrutura completa e depois cada seção detalhada.
```

---

## DICAS DE USO

1. Cole o prompt acima no Claude
2. Ele vai gerar o código do site
3. Crie os arquivos no projeto (pode ser um projeto separado ou na mesma pasta)
4. Substitua as imagens placeholder por screenshots reais do Clinike

## SCREENSHOTS SUGERIDOS

Tire prints das seguintes telas do Clinike para usar no site:
- [ ] Dashboard principal
- [ ] Agenda com consultas
- [ ] Ficha do paciente
- [ ] Tela do financeiro
- [ ] CRM com leads
- [ ] Tela mobile (celular)

---

## ALTERNATIVA: Usar no Próprio Projeto

Se quiser adicionar a landing page no mesmo projeto Clinike:

1. Crie `src/app/(marketing)/page.tsx` para a landing
2. Crie `src/app/(marketing)/layout.tsx` sem sidebar
3. A rota `/` será a landing, `/dashboard` o sistema

---

Criado em: 19/04/2026
