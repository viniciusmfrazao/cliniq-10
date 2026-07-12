'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { parseSupabaseError } from '@/lib/error-messages'
import AudioModeField, { EnvioMode } from '@/components/ui/AudioModeField'


// ─── Tipos ───────────────────────────────────────────────────────────────────

type Vars = { nome: string; primeiro_nome: string; clinica: string; profissional: string; procedimento: string; data: string; hora: string; dia_semana: string; link_confirmacao: string }

const TAGS = [
  { tag: '{{primeiro_nome}}',    desc: 'Primeiro nome do paciente' },
  { tag: '{{nome}}',             desc: 'Nome completo' },
  { tag: '{{clinica}}',          desc: 'Nome da clínica' },
  { tag: '{{profissional}}',     desc: 'Nome do profissional' },
  { tag: '{{procedimento}}',     desc: 'Nome do procedimento' },
  { tag: '{{data}}',             desc: 'Data da consulta (dd/mm/aaaa)' },
  { tag: '{{hora}}',             desc: 'Hora da consulta (hh:mm)' },
  { tag: '{{dia_semana}}',       desc: 'Dia da semana por extenso' },
  { tag: '{{link_confirmacao}}', desc: '🔗 Link de confirmação de presença' },
]

const SUGGESTIONS_24H = [
  {
    id: 'simples',
    label: 'Simples e direto',
    text: `Oi {{primeiro_nome}}! Passando pra lembrar que amanhã, {{dia_semana}} ({{data}}), você tem {{procedimento}} às {{hora}} aqui na {{clinica}}. Te esperamos! 💕`,
  },
  {
    id: 'detalhado',
    label: 'Com endereço',
    text: `Oi {{primeiro_nome}}! Lembrete do seu agendamento amanhã ({{data}}) às {{hora}} com {{profissional}} na {{clinica}}. Qualquer dúvida, estamos por aqui! ✨`,
  },
  {
    id: 'confirme',
    label: 'Pede confirmação',
    text: `Oi {{primeiro_nome}}, tudo bem? Amanhã é o seu dia aqui na {{clinica}}! 🗓\n\n{{procedimento}} às {{hora}} com {{profissional}}.\n\nVai conseguir comparecer? Responda SIM ou NOS AVISE se precisar remarcar. 💕`,
  },
  {
    id: 'link_confirmacao',
    label: '🔗 Com link de confirmação',
    text: `Oi {{primeiro_nome}}! Passando pra lembrar que amanhã você tem {{procedimento}} às {{hora}} aqui na {{clinica}}. 💕\n\nPra garantir seu horário, confirme sua presença aqui: {{link_confirmacao}}`,
  },
]

const SUGGESTIONS_2H = [
  {
    id: 'simples',
    label: 'Simples',
    text: `Oi {{primeiro_nome}}! Daqui a pouco é o seu horário aqui na {{clinica}} 🕐\n\nHoje às {{hora}} com {{profissional}}.\n\nTe esperamos! 💕`,
  },
  {
    id: 'endereco',
    label: 'Com endereço',
    text: `Oi {{primeiro_nome}}! Passando pra lembrar que em 2 horas é a sua vez aqui na {{clinica}} — hoje às {{hora}} com {{profissional}}. Já deixamos tudo preparado pra você! ✨`,
  },
]

const SUGGESTIONS_AGENDAMENTO = [
  {
    id: 'confirmacao',
    label: 'Confirmação',
    text: `Olá {{primeiro_nome}}, seu agendamento de {{procedimento}} foi marcado para dia {{data}} às {{hora}}.\n\nFicamos felizes e vamos ficar te aguardando! 💕`,
  },
  {
    id: 'com_profissional',
    label: 'Com nome do profissional',
    text: `Olá {{primeiro_nome}}! Seu agendamento de {{procedimento}} com {{profissional}} ficou marcado para {{data}} às {{hora}} 💕\n\nQualquer imprevisto, é só nos chamar por aqui.`,
  },
  {
    id: 'com_endereco',
    label: 'Com endereço da clínica',
    text: `Oi {{primeiro_nome}}! Seu agendamento na {{clinica}} foi confirmado para {{data}} às {{hora}} 📍\n\nTe esperamos! Qualquer dúvida, é só chamar por aqui.`,
  },
]

function renderPreview(template: string, vars: Vars): string {
  return template
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, vars.primeiro_nome)
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*profissional\s*\}\}/g, vars.profissional)
    .replace(/\{\{\s*procedimento\s*\}\}/g, vars.procedimento)
    .replace(/\{\{\s*data\s*\}\}/g, vars.data)
    .replace(/\{\{\s*hora\s*\}\}/g, vars.hora)
    .replace(/\{\{\s*dia_semana\s*\}\}/g, vars.dia_semana)
    .replace(/\{\{\s*link_confirmacao\s*\}\}/g, vars.link_confirmacao)
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Initial = {
  enabled: boolean
  hora: number
  template24h: string
  lembrete2hEnabled: boolean
  template2h: string
  msgAgendamentoEnabled: boolean
  templateAgendamento: string
  modo24h: EnvioMode
  audio24h: string | null
  modo2h: EnvioMode
  audio2h: string | null
  modoAgendamento: EnvioMode
  audioAgendamento: string | null
}

type Props = { clinicId: string; clinicName: string; initial: Initial }

// ─── Componente ──────────────────────────────────────────────────────────────

export default function AppointmentReminderForm({ clinicId, clinicName, initial }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [enabled, setEnabled]             = useState(initial.enabled)
  const [hora, setHora]                   = useState(String(initial.hora).padStart(2, '0') + ':00')
  const [template24h, setTemplate24h]     = useState(initial.template24h)
  const [lembrete2h, setLembrete2h]       = useState(initial.lembrete2hEnabled)
  const [template2h, setTemplate2h]       = useState(initial.template2h)
  const [msgAgendamento, setMsgAgendamento]   = useState(initial.msgAgendamentoEnabled)
  const [templateAgendamento, setTemplateAgendamento] = useState(initial.templateAgendamento)
  const [modo24h, setModo24h]             = useState<EnvioMode>(initial.modo24h)
  const [audio24h, setAudio24h]           = useState<string | null>(initial.audio24h)
  const [modo2h, setModo2h]               = useState<EnvioMode>(initial.modo2h)
  const [audio2h, setAudio2h]             = useState<string | null>(initial.audio2h)
  const [modoAgendamento, setModoAgendamento] = useState<EnvioMode>(initial.modoAgendamento)
  const [audioAgendamento, setAudioAgendamento] = useState<string | null>(initial.audioAgendamento)
  const [saving, setSaving]               = useState(false)
  const [savedAt, setSavedAt]             = useState<Date | null>(null)
  const [activeTab, setActiveTab]         = useState<'24h' | '2h' | 'agendamento'>('24h')
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const previewVars: Vars = {
    nome: 'Maria Aparecida da Silva',
    primeiro_nome: 'Maria',
    clinica: clinicName,
    profissional: 'Dra. Ana',
    procedimento: 'Botox',
    data: new Date(Date.now() + 86400000).toLocaleDateString('pt-BR'),
    hora: '14:30',
    dia_semana: 'terça-feira',
    link_confirmacao: 'app.clinike.com.br/confirmar/abc12345',
  }

  const preview24h = useMemo(() => renderPreview(template24h, previewVars), [template24h])
  const preview2h  = useMemo(() => renderPreview(template2h, previewVars), [template2h])
  const previewAgendamento = useMemo(() => renderPreview(templateAgendamento, previewVars), [templateAgendamento])

  async function sendTest(template: string, previewFn: (t: string) => string, mode: EnvioMode, audioUrl: string | null) {
    if (!testPhone.trim()) {
      setTestMsg({ kind: 'err', text: 'Informe um número com DDD (ex: 5534999999999)' })
      return
    }
    if (mode === 'audio' && !audioUrl) {
      setTestMsg({ kind: 'err', text: 'Grave um áudio antes de testar.' })
      return
    }
    setTesting(true)
    setTestMsg(null)
    try {
      if (mode === 'texto' || mode === 'ambos') {
        const text = previewFn(template)
          .replace(/\{\{link_confirmacao\}\}/g, 'https://app.clinike.com.br/confirmar/TESTE-LINK')
        const r = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone, message: text, purpose: 'automation' }),
        })
        const json = await r.json()
        if (!json.ok) {
          setTestMsg({ kind: 'err', text: json.error || 'Erro ao enviar' })
          return
        }
      }
      if (mode === 'audio' || mode === 'ambos') {
        const rAudio = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone, type: 'audio', media: audioUrl, purpose: 'automation' }),
        })
        const jAudio = await rAudio.json()
        if (!jAudio.ok) {
          setTestMsg({ kind: 'err', text: jAudio.error || 'Erro ao enviar áudio' })
          return
        }
      }
      setTestMsg({ kind: 'ok', text: 'Mensagem de teste enviada com sucesso!' })
    } catch {
      setTestMsg({ kind: 'err', text: 'Erro de conexão' })
    } finally {
      setTesting(false)
    }
  }

  async function save() {
    setSaving(true)
    setSavedAt(null)
    try {
      // Converter hora "HH:MM" para número inteiro
      const horaInt = parseInt(hora.split(':')[0], 10)
      const { error } = await supabase
        .from('clinic_automations')
        .update({
          confirma_24h: enabled,
          confirma_24h_hora: horaInt,
          template_confirma_24h: template24h,
          lembrete_2h: lembrete2h,
          template_lembrete_2h: template2h || null,
          msg_agendamento: msgAgendamento,
          template_msg_agendamento: templateAgendamento || null,
          modo_confirma_24h: modo24h,
          audio_confirma_24h: audio24h,
          modo_lembrete_2h: modo2h,
          audio_lembrete_2h: audio2h,
          modo_msg_agendamento: modoAgendamento,
          audio_msg_agendamento: audioAgendamento,
        })
        .eq('clinic_id', clinicId)
      if (error) { alert(parseSupabaseError(error)); return }
      setSavedAt(new Date())
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const tagBtn = (tag: string, setFn: (v: string) => void, current: string) => (
    <button
      key={tag}
      type="button"
      onClick={() => setFn(current + tag)}
      className="px-2 py-1 text-xs bg-slate-100 hover:bg-violet-100 hover:text-violet-700 rounded-lg font-mono transition-colors"
    >
      {tag}
    </button>
  )

  return (
    <div className="p-6 space-y-4">
      {/* Toggle principal */}
      <label className="flex items-start gap-4 cursor-pointer">
        <div className="relative inline-flex items-center mt-1">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">Ativar lembrete automático</p>
          <p className="text-sm text-slate-500">Envia mensagem ao confirmar o agendamento, na véspera e/ou 2h antes da consulta.</p>
        </div>
      </label>

      <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>

        {/* Abas: confirmação de agendamento / véspera / 2h antes */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
          <button
            onClick={() => setActiveTab('agendamento')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'agendamento' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ✅ Confirmação de agendamento
          </button>
          <button
            onClick={() => setActiveTab('24h')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === '24h' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📅 Véspera (D-1)
          </button>
          <button
            onClick={() => setActiveTab('2h')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === '2h' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🕐 2h antes
          </button>
        </div>

        {/* ABA VÉSPERA */}
        {activeTab === '24h' && (
          <div className="space-y-4">
            {/* Horário livre */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Horário do envio <span className="text-xs text-slate-400">(fuso de Brasília)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"
                />
                <p className="text-xs text-slate-500">
                  A mensagem é enviada na véspera neste horário para todos os pacientes do dia seguinte.
                </p>
              </div>
            </div>

            {/* Sugestões */}
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Sugestões de texto:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS_24H.map(s => (
                  <button key={s.id} type="button" onClick={() => setTemplate24h(s.text)}
                    className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-violet-100 hover:text-violet-700 rounded-lg transition-colors">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Inserir variável:</p>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map(t => tagBtn(t.tag, setTemplate24h, template24h))}
              </div>
            </div>

            {/* Modo de envio + áudio */}
            <AudioModeField
              clinicId={clinicId}
              automationKey="confirma-24h"
              mode={modo24h}
              onModeChange={setModo24h}
              audioUrl={audio24h}
              onAudioChange={setAudio24h}
            />

            {/* Template */}
            {(modo24h === 'texto' || modo24h === 'ambos') && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">Mensagem da véspera</label>
              <textarea
                value={template24h}
                onChange={e => setTemplate24h(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-none"
                placeholder="Digite a mensagem de lembrete da véspera..."
              />
            </div>
            )}

            {/* Preview */}
            {template24h && (modo24h === 'texto' || modo24h === 'ambos') && (
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-xs font-medium text-emerald-700 mb-2">Preview (véspera):</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{preview24h}</p>
              </div>
            )}
          </div>
        )}

        {/* ABA 2H ANTES */}
        {activeTab === '2h' && (
          <div className="space-y-4">
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="relative inline-flex items-center mt-1">
                <input type="checkbox" checked={lembrete2h} onChange={e => setLembrete2h(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Ativar lembrete 2h antes</p>
                <p className="text-sm text-slate-500">Envia uma segunda mensagem 2 horas antes da consulta, no mesmo dia.</p>
              </div>
            </label>

            <div className={lembrete2h ? '' : 'opacity-50 pointer-events-none'}>
              {/* Sugestões */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-2 font-medium">Sugestões:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS_2H.map(s => (
                    <button key={s.id} type="button" onClick={() => setTemplate2h(s.text)}
                      className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-violet-100 hover:text-violet-700 rounded-lg transition-colors">
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-2 font-medium">Inserir variável:</p>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.map(t => tagBtn(t.tag, setTemplate2h, template2h))}
                </div>
              </div>

              {/* Modo de envio + áudio */}
              <AudioModeField
                clinicId={clinicId}
                automationKey="lembrete-2h"
                mode={modo2h}
                onModeChange={setModo2h}
                audioUrl={audio2h}
                onAudioChange={setAudio2h}
              />

              {/* Template */}
              {(modo2h === 'texto' || modo2h === 'ambos') && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-900 mb-1">Mensagem 2h antes</label>
                <textarea
                  value={template2h}
                  onChange={e => setTemplate2h(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-none"
                  placeholder="Digite a mensagem enviada 2h antes da consulta..."
                />
              </div>
              )}

              {/* Preview */}
              {template2h && (modo2h === 'texto' || modo2h === 'ambos') && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <p className="text-xs font-medium text-blue-700 mb-2">Preview (2h antes):</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{preview2h}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA CONFIRMAÇÃO DE AGENDAMENTO */}
        {activeTab === 'agendamento' && (
          <div className="space-y-4">
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="relative inline-flex items-center mt-1">
                <input type="checkbox" checked={msgAgendamento} onChange={e => setMsgAgendamento(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Ativar confirmação de agendamento</p>
                <p className="text-sm text-slate-500">Envia automaticamente assim que um novo agendamento é criado (qualquer que seja a tela usada). Não envia pra agendamentos importados de histórico.</p>
              </div>
            </label>

            <div className={msgAgendamento ? '' : 'opacity-50 pointer-events-none'}>
              {/* Sugestões */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-2 font-medium">Sugestões:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS_AGENDAMENTO.map(s => (
                    <button key={s.id} type="button" onClick={() => setTemplateAgendamento(s.text)}
                      className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-violet-100 hover:text-violet-700 rounded-lg transition-colors">
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-2 font-medium">Inserir variável:</p>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.filter(t => t.tag !== '{{link_confirmacao}}').map(t => tagBtn(t.tag, setTemplateAgendamento, templateAgendamento))}
                </div>
              </div>

              {/* Modo de envio + áudio */}
              <AudioModeField
                clinicId={clinicId}
                automationKey="msg-agendamento"
                mode={modoAgendamento}
                onModeChange={setModoAgendamento}
                audioUrl={audioAgendamento}
                onAudioChange={setAudioAgendamento}
              />

              {/* Template */}
              {(modoAgendamento === 'texto' || modoAgendamento === 'ambos') && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-900 mb-1">Mensagem de confirmação</label>
                <textarea
                  value={templateAgendamento}
                  onChange={e => setTemplateAgendamento(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-none"
                  placeholder="Digite a mensagem enviada ao criar o agendamento..."
                />
              </div>
              )}

              {/* Preview */}
              {templateAgendamento && (modoAgendamento === 'texto' || modoAgendamento === 'ambos') && (
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <p className="text-xs font-medium text-emerald-700 mb-2">Preview (confirmação de agendamento):</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{previewAgendamento}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Teste */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4">
        <p className="font-semibold text-sm text-slate-900 mb-2">Enviar teste pra um número</p>
        <p className="text-xs text-slate-500 mb-3">Recomendamos testar pro seu próprio celular antes de ativar. O link de confirmação aparecerá como exemplo.</p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="Ex: 5534999999999"
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
          <button
            type="button"
            onClick={() => sendTest(activeTab === '24h' ? template24h : activeTab === '2h' ? template2h : templateAgendamento, t => t
              .replace(/\{\{primeiro_nome\}\}/g, 'Ana')
              .replace(/\{\{nome\}\}/g, 'Ana Silva')
              .replace(/\{\{clinica\}\}/g, 'Clínica')
              .replace(/\{\{profissional\}\}/g, 'Dra. Sarah')
              .replace(/\{\{procedimento\}\}/g, 'Botox')
              .replace(/\{\{data\}\}/g, '08/06/2026')
              .replace(/\{\{hora\}\}/g, '10:00')
              .replace(/\{\{dia_semana\}\}/g, 'Segunda-feira')
            , activeTab === '24h' ? modo24h : activeTab === '2h' ? modo2h : modoAgendamento
            , activeTab === '24h' ? audio24h : activeTab === '2h' ? audio2h : audioAgendamento)}
            disabled={testing}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {testing ? '...' : '📤 Enviar teste'}
          </button>
        </div>
        {testMsg && (
          <div className={`mt-3 p-2 rounded-lg text-xs ${testMsg.kind === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {testMsg.text}
          </div>
        )}
      </div>

      {/* Salvar */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {savedAt && (
          <p className="text-xs text-emerald-600">
            Salvo às {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}



