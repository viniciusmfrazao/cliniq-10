'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

const WHATSAPP_LINK = 'https://wa.me/5534991805722?text=Olá! Quero conhecer o Clinike'

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-black text-lg">C</span>
              </div>
              <span className="text-xl font-black text-slate-900">Clinike</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#funcionalidades" className="text-slate-600 hover:text-violet-600 font-medium transition-colors">Funcionalidades</a>
              <a href="#planos" className="text-slate-600 hover:text-violet-600 font-medium transition-colors">Planos</a>
              <a href="#faq" className="text-slate-600 hover:text-violet-600 font-medium transition-colors">FAQ</a>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:inline-flex text-slate-700 font-semibold hover:text-violet-600 transition-colors">
                Entrar
              </Link>
              <a 
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
              >
                <WhatsAppIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Falar Conosco</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-violet-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-300/30 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                +500 clínicas já usam
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-tight">
                Sua clínica no 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600"> piloto automático</span>
              </h1>
              
              <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0">
                O sistema mais completo para clínicas de estética. Agenda, pacientes, financeiro, CRM, estoque e 
                <strong className="text-violet-600"> atendimento automático via WhatsApp com IA</strong>.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a 
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-violet-500/30 hover:shadow-2xl hover:shadow-violet-500/40 hover:-translate-y-1 transition-all"
                >
                  <WhatsAppIcon className="w-6 h-6" />
                  Começar Agora - É Grátis
                </a>
                <a 
                  href="#funcionalidades"
                  className="inline-flex items-center justify-center gap-2 bg-white text-slate-700 px-8 py-4 rounded-2xl font-bold text-lg border-2 border-slate-200 hover:border-violet-300 hover:text-violet-600 transition-all"
                >
                  Ver Funcionalidades
                </a>
              </div>

              <div className="mt-10 flex items-center justify-center lg:justify-start gap-6">
                <div className="flex -space-x-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <StarIcon key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">+200 avaliações 5 estrelas</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/20 border border-slate-200">
                <Image 
                  src="/landing/dashboard-mockup.png" 
                  alt="Dashboard Clinike" 
                  width={800} 
                  height={500}
                  className="w-full"
                  priority
                />
              </div>
              <div className="absolute -bottom-6 -left-6 w-48 rounded-2xl overflow-hidden shadow-xl border border-slate-200 hidden md:block">
                <Image 
                  src="/landing/mobile-mockup.png" 
                  alt="App Mobile Clinike" 
                  width={200} 
                  height={400}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos / Social Proof */}
      <section className="py-12 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-slate-500 text-sm font-medium mb-8">CLÍNICAS QUE CONFIAM NO CLINIKE</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-60">
            {['Clínica Sarah Pina', 'Estética Avançada', 'Dermato Center', 'Belle Clinic', 'Skin Care Pro'].map(name => (
              <div key={name} className="text-xl md:text-2xl font-bold text-slate-400">{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">
              Chega de perder tempo e dinheiro
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Você ainda enfrenta esses problemas na sua clínica?
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '📅', title: 'Agenda desorganizada', desc: 'Pacientes esperando, horários vazios, conflitos de agenda entre profissionais.' },
              { icon: '💬', title: 'WhatsApp lotado', desc: 'Horas respondendo mensagens, perdendo leads, esquecendo de confirmar consultas.' },
              { icon: '💰', title: 'Financeiro bagunçado', desc: 'Sem saber quanto entra, quanto sai, comissões erradas, notas fiscais atrasadas.' },
              { icon: '📋', title: 'Papelada infinita', desc: 'Fichas de papel, termos impressos, fotos no celular pessoal, nada organizado.' },
              { icon: '📊', title: 'Sem visão do negócio', desc: 'Não sabe quais procedimentos mais vendem, qual profissional performa melhor.' },
              { icon: '😰', title: 'Estresse constante', desc: 'Trabalhando mais, ganhando menos, sem tempo para focar no que importa.' },
            ].map((item, idx) => (
              <div key={idx} className="bg-rose-50 border border-rose-100 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <span className="text-3xl">{item.icon}</span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-black">
            A solução que você precisa
          </h2>
          <p className="mt-6 text-xl text-white/80 max-w-3xl mx-auto">
            O Clinike automatiza toda a gestão da sua clínica. 
            <strong className="text-white"> Você foca nos pacientes, a gente cuida do resto.</strong>
          </p>
          
          <div className="mt-12 grid md:grid-cols-4 gap-6">
            {[
              { number: '85%', label: 'menos tempo em tarefas administrativas' },
              { number: '3x', label: 'mais agendamentos com Donna IA' },
              { number: '40%', label: 'aumento no faturamento médio' },
              { number: '0', label: 'pacientes esquecidos' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-4xl md:text-5xl font-black">{stat.number}</p>
                <p className="mt-2 text-white/80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">
              Tudo que sua clínica precisa
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Um sistema completo que substitui planilhas, agendas de papel e múltiplos aplicativos
            </p>
          </div>

          {/* Feature 1: Agenda */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                📅 Agenda Inteligente
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900">
                Nunca mais perca um agendamento
              </h3>
              <p className="mt-4 text-lg text-slate-600">
                Visualize todos os profissionais, salas e horários em uma única tela. 
                Arraste e solte para reagendar, confirme com um clique, envie lembretes automáticos.
              </p>
              <ul className="mt-6 space-y-3">
                {['Visão por dia, semana ou mês', 'Múltiplos profissionais e salas', 'Confirmação automática via WhatsApp', 'Check-in de pacientes'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <CheckIcon className="w-5 h-5 text-emerald-500" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/10 border border-slate-200">
              <Image 
                src="/landing/agenda-mockup.png" 
                alt="Agenda Clinike" 
                width={700} 
                height={450}
                className="w-full"
              />
            </div>
          </div>

          {/* Feature 2: Donna IA */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="order-2 lg:order-1">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-2xl">
                <div className="bg-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center">
                      <WhatsAppIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Clínica Estética</p>
                      <p className="text-xs text-slate-500">Online agora</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-end">
                      <div className="bg-emerald-100 text-slate-800 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                        Oi, quero saber sobre botox
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
                        Olá! 🤍 Eu sou a Donna. O Botox custa 12x de R$90. Posso ver horários para você?
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-emerald-100 text-slate-800 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                        Sim, quero agendar
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
                        Temos quinta às 14h com a Dra. Amanda. Confirmo? ✨
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                🤖 Donna IA
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900">
                Atendimento 24h no WhatsApp com IA
              </h3>
              <p className="mt-4 text-lg text-slate-600">
                A Donna responde seus pacientes a qualquer hora, informa preços, agenda consultas e 
                nunca esquece de fazer follow-up. Como ter uma recepcionista que nunca dorme.
              </p>
              <ul className="mt-6 space-y-3">
                {['Responde preços e dúvidas automaticamente', 'Agenda direto no sistema', 'Envia lembretes e confirmações', 'Aprende o tom da sua clínica'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <CheckIcon className="w-5 h-5 text-emerald-500" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Other Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {[
              { icon: '👥', title: 'Gestão de Pacientes', desc: 'Cadastro completo, histórico, anamneses, fotos antes/depois, tudo em um só lugar.' },
              { icon: '💰', title: 'Financeiro Completo', desc: 'Entradas, saídas, comissões, DRE. Saiba exatamente quanto sua clínica fatura.' },
              { icon: '📦', title: 'Controle de Estoque', desc: 'Gerencie produtos, injetáveis, alertas de validade e reposição automática.' },
              { icon: '🎯', title: 'CRM de Leads', desc: 'Funil de vendas visual, acompanhe cada lead da primeira mensagem até a conversão.' },
              { icon: '📋', title: 'Prontuário Digital', desc: 'Evoluções, prescrições, marcação de pontos em face, tudo digital e seguro.' },
              { icon: '📄', title: 'Documentos', desc: 'Termos de consentimento com assinatura digital. Sem papel, sem burocracia.' },
            ].map((feature, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:border-violet-200 transition-all">
                <span className="text-3xl">{feature.icon}</span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20 md:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">
              Planos que cabem no seu bolso
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Comece grátis por 14 dias. Sem cartão de crédito.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-slate-900">Starter</h3>
              <p className="text-slate-500 mt-1">Para clínicas iniciantes</p>
              <div className="mt-6">
                <span className="text-4xl font-black text-slate-900">R$197</span>
                <span className="text-slate-500">/mês</span>
              </div>
              <ul className="mt-8 space-y-4">
                {['Até 2 profissionais', 'Agenda completa', 'Gestão de pacientes', 'Financeiro básico', 'Suporte por email'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <CheckIcon className="w-5 h-5 text-emerald-500" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <a 
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 block w-full text-center bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Começar Grátis
              </a>
            </div>

            {/* Professional */}
            <div className="bg-gradient-to-br from-violet-600 to-purple-600 rounded-3xl p-8 text-white relative shadow-xl shadow-violet-500/30 scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-sm font-bold px-4 py-1 rounded-full">
                MAIS POPULAR
              </div>
              <h3 className="text-xl font-bold">Professional</h3>
              <p className="text-white/70 mt-1">Para clínicas em crescimento</p>
              <div className="mt-6">
                <span className="text-4xl font-black">R$397</span>
                <span className="text-white/70">/mês</span>
              </div>
              <ul className="mt-8 space-y-4">
                {['Até 5 profissionais', 'Tudo do Starter +', 'Donna IA (WhatsApp)', 'CRM completo', 'Estoque', 'Prontuário digital', 'Suporte prioritário'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <CheckIcon className="w-5 h-5 text-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a 
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 block w-full text-center bg-white text-violet-600 px-6 py-3 rounded-xl font-bold hover:bg-violet-50 transition-colors"
              >
                Começar Grátis
              </a>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-slate-900">Enterprise</h3>
              <p className="text-slate-500 mt-1">Para grandes clínicas</p>
              <div className="mt-6">
                <span className="text-4xl font-black text-slate-900">R$697</span>
                <span className="text-slate-500">/mês</span>
              </div>
              <ul className="mt-8 space-y-4">
                {['Profissionais ilimitados', 'Tudo do Professional +', 'Multi-unidades', 'API personalizada', 'Relatórios avançados', 'Gerente de conta'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <CheckIcon className="w-5 h-5 text-emerald-500" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <a 
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 block w-full text-center bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Falar com Vendas
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">
              O que dizem nossos clientes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: 'Dra. Amanda Silva', role: 'Clínica Estética SP', text: 'O Clinike transformou minha clínica. A Donna IA agenda sozinha enquanto eu atendo. Triplicou meus agendamentos!' },
              { name: 'Dr. Pedro Santos', role: 'Dermato Center', text: 'Finalmente tenho controle do financeiro. Sei exatamente quanto cada profissional fatura e quanto sobra no final do mês.' },
              { name: 'Sarah Pina', role: 'Clínica Sarah Pina', text: 'A melhor decisão que tomei foi migrar para o Clinike. Suporte incrível, sistema intuitivo, equipe adora usar.' },
            ].map((testimonial, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-8">
                <div className="flex items-center gap-1 mb-4">
                  {[1,2,3,4,5].map(i => (
                    <StarIcon key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 italic">&quot;{testimonial.text}&quot;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">
              Perguntas Frequentes
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { q: 'Preciso instalar algo no computador?', a: 'Não! O Clinike é 100% na nuvem. Acesse de qualquer navegador, em qualquer dispositivo. Funciona no computador, tablet e celular.' },
              { q: 'Posso testar antes de pagar?', a: 'Sim! Oferecemos 14 dias de teste grátis, sem precisar de cartão de crédito. Você só paga se gostar.' },
              { q: 'Como funciona a Donna IA?', a: 'A Donna é nossa assistente de IA que responde automaticamente no WhatsApp da sua clínica. Ela informa preços, agenda consultas e faz follow-up com leads.' },
              { q: 'Meus dados estão seguros?', a: 'Totalmente! Usamos criptografia de ponta a ponta, servidores seguros e backup automático diário. Seus dados são só seus.' },
              { q: 'Consigo migrar meus dados de outro sistema?', a: 'Sim! Nossa equipe ajuda você a migrar pacientes, agendamentos e histórico de outros sistemas ou planilhas.' },
              { q: 'Tem suporte humano?', a: 'Claro! Nosso suporte é via WhatsApp, com humanos de verdade. Tempo médio de resposta: 5 minutos em horário comercial.' },
            ].map((faq, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-semibold text-slate-900">{faq.q}</span>
                  <ChevronIcon className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-6 text-slate-600">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-black">
            Pronto para transformar sua clínica?
          </h2>
          <p className="mt-6 text-xl text-white/80">
            Junte-se a +500 clínicas que já economizam tempo e aumentam o faturamento com o Clinike.
          </p>
          <a 
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-3 bg-white text-violet-600 px-10 py-5 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
          >
            <WhatsAppIcon className="w-7 h-7" />
            Começar Agora - 14 Dias Grátis
          </a>
          <p className="mt-4 text-white/60 text-sm">Sem cartão de crédito • Cancele quando quiser</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-lg">C</span>
                </div>
                <span className="text-xl font-black">Clinike</span>
              </div>
              <p className="text-slate-400 text-sm">
                O sistema mais completo para gestão de clínicas de estética.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#planos" className="hover:text-white transition-colors">Planos</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Suporte</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href={WHATSAPP_LINK} className="hover:text-white transition-colors">WhatsApp</a></li>
                <li><a href="mailto:suporte@clinike.com.br" className="hover:text-white transition-colors">Email</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contato</h4>
              <a 
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
              >
                <WhatsAppIcon className="w-5 h-5" />
                (34) 99180-5722
              </a>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
            © {new Date().getFullYear()} Clinike. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* WhatsApp Float Button */}
      <a 
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-110 transition-transform"
      >
        <WhatsAppIcon className="w-8 h-8 text-white" />
      </a>
    </div>
  )
}

// Icons
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
