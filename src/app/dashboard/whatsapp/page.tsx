'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type Conversation = {
  id: string
  phone: string
  name: string
  lastMessage: string
  lastMessageTime: string
  unread: number
}

type Message = {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
}

export default function WhatsAppPage() {
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [patient, setPatient] = useState<any>(null)
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: userData } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', user.id)
        .single()
      
      if (!userData?.clinic_id) return
      
      const { data: integration } = await supabase
        .from('clinic_integrations')
        .select('*')
        .eq('clinic_id', userData.clinic_id)
        .eq('provider', 'evolution_api')
        .single()
      
      if (integration?.config?.url && integration?.config?.api_key) {
        setConfig(integration.config)
        setConfigured(true)
        loadConversations(userData.clinic_id)
      } else {
        setConfigured(false)
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadConversations(clinicId: string) {
    // Buscar conversas do eva_conversations agrupadas por telefone
    const { data } = await supabase
      .from('eva_conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
    
    if (data) {
      // Agrupar por telefone
      const grouped: Record<string, any[]> = {}
      data.forEach(msg => {
        if (!grouped[msg.phone]) grouped[msg.phone] = []
        grouped[msg.phone].push(msg)
      })
      
      // Converter para lista de conversas
      const convs: Conversation[] = Object.entries(grouped).map(([phone, msgs]) => {
        const lastMsg = msgs[0]
        return {
          id: phone,
          phone,
          name: lastMsg.patient_name || phone,
          lastMessage: lastMsg.content?.substring(0, 50) + '...',
          lastMessageTime: lastMsg.created_at,
          unread: 0
        }
      })
      
      setConversations(convs)
    }
  }

  async function loadMessages(phone: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data: userData } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()
    
    const { data: msgs } = await supabase
      .from('eva_conversations')
      .select('*')
      .eq('clinic_id', userData?.clinic_id)
      .eq('phone', phone)
      .order('created_at', { ascending: true })
    
    if (msgs) {
      setMessages(msgs.map(m => ({
        id: m.id,
        content: m.content,
        role: m.role,
        created_at: m.created_at
      })))
    }
    
    // Buscar dados do paciente
    const { data: patientData } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', userData?.clinic_id)
      .eq('phone', phone)
      .single()
    
    setPatient(patientData)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation || !config) return
    
    setSending(true)
    try {
      const response = await fetch('/api/evolution/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          phone: selectedConversation.phone,
          message: newMessage
        })
      })
      
      if (response.ok) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: newMessage,
          role: 'assistant',
          created_at: new Date().toISOString()
        }])
        setNewMessage('')
      }
    } catch (error) {
      console.error('Error sending:', error)
    } finally {
      setSending(false)
    }
  }

  function selectConversation(conv: Conversation) {
    setSelectedConversation(conv)
    loadMessages(conv.phone)
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-300">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            WhatsApp não configurado
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Configure a Evolution API nas integrações para usar o chat do WhatsApp.
          </p>
          <Link
            href="/dashboard/config/integracoes"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Icon name="settings" className="w-5 h-5" />
            Configurar Integrações
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp</h1>
          <p className="text-sm text-slate-500">Conversas via Evolution API</p>
        </div>
        <button
          onClick={() => loadConfig()}
          className="btn-secondary flex items-center gap-2"
        >
          <Icon name="refresh" className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <div className="flex-1 card overflow-hidden flex">
        {/* Lista de conversas */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Icon name="message" className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Nenhuma conversa ainda</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left ${
                    selectedConversation?.id === conv.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      {conv.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{conv.name}</p>
                    <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(conv.lastMessageTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header do chat */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {selectedConversation.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{selectedConversation.name}</p>
                  <p className="text-xs text-slate-500">{selectedConversation.phone}</p>
                </div>
                {patient && (
                  <Link
                    href={`/dashboard/pacientes/${patient.id}`}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Ver ficha
                  </Link>
                )}
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                        msg.role === 'assistant'
                          ? 'bg-emerald-500 text-white rounded-br-md'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.role === 'assistant' ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {sending ? '...' : 'Enviar'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Icon name="message" className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
