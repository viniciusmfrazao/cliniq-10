'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NAV_ITEMS, type NavItem } from '@/lib/nav'
import { isRouteEnabled, type ModuleId } from '@/lib/modules'
import Icon from '@/components/ui/Icon'

type Patient = { id: string; name: string; phone: string | null }

type CommandItem = {
  id: string
  label: string
  hint?: string
  icon: string
  group: 'pagina' | 'acao' | 'paciente'
  keywords?: string
  onSelect: () => void
}

type Ctx = {
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: boolean
}

const CommandContext = createContext<Ctx | null>(null)

export function useCommandPalette() {
  const ctx = useContext(CommandContext)
  if (!ctx) throw new Error('useCommandPalette must be inside <CommandPaletteProvider>')
  return ctx
}

type ProviderProps = {
  children: React.ReactNode
  userRole: string
  activeModules: ModuleId[]
  clinicId: string
  comissaoAtiva?: boolean
}

export default function CommandPaletteProvider({
  children,
  userRole,
  activeModules,
  clinicId,
  comissaoAtiva = false,
}: ProviderProps) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  // Atalho global Ctrl+K / Cmd+K + "/" pra abrir, Esc pra fechar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.ctrlKey || e.metaKey
      if (cmd && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        toggle()
        return
      }
      // "/" abre, mas nao quando o usuario esta digitando em algum input
      if (e.key === '/' && !isTypingInField(e.target)) {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, toggle])

  const value = useMemo<Ctx>(() => ({ open, close, toggle, isOpen }), [open, close, toggle, isOpen])

  return (
    <CommandContext.Provider value={value}>
      {children}
      {isOpen ? (
        <CommandPaletteDialog
          onClose={close}
          userRole={userRole}
          activeModules={activeModules}
          clinicId={clinicId}
          comissaoAtiva={comissaoAtiva}
        />
      ) : null}
    </CommandContext.Provider>
  )
}

function isTypingInField(t: EventTarget | null) {
  if (!t || !(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable
}

function CommandPaletteDialog({
  onClose,
  userRole,
  activeModules,
  clinicId,
  comissaoAtiva,
}: {
  onClose: () => void
  userRole: string
  activeModules: ModuleId[]
  clinicId: string
  comissaoAtiva: boolean
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Foca o input ao abrir
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Esc fecha (alem do listener global do provider, garante mesmo com stopPropagation)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Busca pacientes (debounced)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setPatients([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, name, phone')
        .eq('clinic_id', clinicId)
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(8)
      if (!cancelled) {
        setPatients(data || [])
        setLoading(false)
      }
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, supabase, clinicId])

  // Lista de paginas filtrada por role + modulos ativos
  const pageItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []
    for (const item of NAV_ITEMS) {
      if (!item.roles.includes(userRole)) continue
      if (activeModules.length > 0 && !isRouteEnabled(item.href, activeModules)) continue
      items.push({
        id: `nav-${item.href}`,
        label: item.label,
        icon: item.icon,
        group: 'pagina',
        keywords: item.label.toLowerCase(),
        onSelect: () => {
          router.push(item.href)
          onClose()
        },
      })
      // Filhos (financeiro tem sub-itens)
      if (item.children) {
        for (const c of item.children) {
          if (c.href === '/dashboard/comissoes/minhas' && !comissaoAtiva) continue
          items.push({
            id: `nav-${c.href}`,
            label: c.label,
            hint: item.label,
            icon: item.icon,
            group: 'pagina',
            keywords: `${item.label} ${c.label}`.toLowerCase(),
            onSelect: () => {
              router.push(c.href)
              onClose()
            },
          })
        }
      }
    }
    return items
  }, [userRole, activeModules, comissaoAtiva, router, onClose])

  // Acoes rapidas (criar coisas + atalhos uteis)
  const actionItems = useMemo<CommandItem[]>(() => {
    const can = (roles: string[]) => roles.includes(userRole)
    const list: CommandItem[] = []
    if (can(['admin', 'doctor', 'esthetician', 'receptionist'])) {
      list.push({
        id: 'act-novo-agendamento',
        label: 'Novo agendamento',
        icon: 'plus',
        group: 'acao',
        keywords: 'novo agendamento agenda',
        onSelect: () => {
          router.push('/dashboard/agenda/novo')
          onClose()
        },
      })
      list.push({
        id: 'act-novo-paciente',
        label: 'Novo paciente',
        icon: 'userPlus',
        group: 'acao',
        keywords: 'novo paciente cadastrar',
        onSelect: () => {
          router.push('/dashboard/pacientes/novo')
          onClose()
        },
      })
    }
    if (can(['admin'])) {
      list.push({
        id: 'act-nova-entrada',
        label: 'Nova entrada financeira',
        icon: 'trendingUp',
        group: 'acao',
        keywords: 'nova entrada financeiro receita',
        onSelect: () => {
          router.push('/dashboard/financeiro/entradas/nova')
          onClose()
        },
      })
      list.push({
        id: 'act-nova-saida',
        label: 'Nova saida financeira',
        icon: 'trendingDown',
        group: 'acao',
        keywords: 'nova saida financeiro despesa',
        onSelect: () => {
          router.push('/dashboard/financeiro/saidas/nova')
          onClose()
        },
      })
    }
    // Disponivel pra todos: guia "Como funciona"
    list.push({
      id: 'act-como-funciona',
      label: 'Como funciona — guia',
      icon: 'info',
      group: 'acao',
      keywords: 'como funciona guia ajuda tutorial onboarding',
      onSelect: () => {
        router.push('/dashboard/como-funciona')
        onClose()
      },
    })
    return list
  }, [userRole, router, onClose])

  const patientItems = useMemo<CommandItem[]>(() => {
    return patients.map((p) => ({
      id: `pac-${p.id}`,
      label: p.name,
      hint: p.phone || undefined,
      icon: 'user',
      group: 'paciente',
      onSelect: () => {
        router.push(`/dashboard/pacientes/${p.id}`)
        onClose()
      },
    }))
  }, [patients, router, onClose])

  // Filtragem (paginas + acoes filtram por keywords; pacientes ja vem filtrado do banco)
  const filtered = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase()
    const filterByQuery = (items: CommandItem[]) =>
      q
        ? items.filter((i) => i.keywords?.includes(q) || i.label.toLowerCase().includes(q))
        : items

    const pages = filterByQuery(pageItems)
    const actions = filterByQuery(actionItems)
    // Pacientes so aparecem se tiver query (>= 2 chars)
    return [...actions, ...pages, ...patientItems]
  }, [pageItems, actionItems, patientItems, query])

  // Reseta o highlight quando lista muda
  useEffect(() => {
    setActive(0)
  }, [query, patientItems.length])

  // Setas + Enter
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[active]?.onSelect()
    }
  }

  // Mantem o item ativo visivel
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [active])

  // Agrupa pra renderizar com cabecalhos
  const groups: { key: string; label: string; items: CommandItem[] }[] = []
  const byGroup: Record<string, CommandItem[]> = {}
  filtered.forEach((it) => {
    byGroup[it.group] = byGroup[it.group] || []
    byGroup[it.group].push(it)
  })
  if (byGroup.acao?.length) groups.push({ key: 'acao', label: 'Acoes rapidas', items: byGroup.acao })
  if (byGroup.paciente?.length)
    groups.push({ key: 'paciente', label: 'Pacientes', items: byGroup.paciente })
  if (byGroup.pagina?.length) groups.push({ key: 'pagina', label: 'Paginas', items: byGroup.pagina })

  // Mapeia idx absoluto pra cada item (pra navegacao por seta funcionar com grupos)
  let cursor = 0

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Busca rapida"
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[8vh] px-3"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm cursor-default"
      />
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-cmd-in">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Icon name="search" className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar pacientes, paginas ou acoes..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
          />
          {loading ? (
            <span className="text-[10px] uppercase tracking-wide text-slate-400">buscando...</span>
          ) : null}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-500 border border-slate-200">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">Nada encontrado</p>
              <p className="text-xs text-slate-500 mt-1">Tente outro termo</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="px-2">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {g.label}
                </p>
                {g.items.map((it) => {
                  const idx = cursor++
                  const isActive = idx === active
                  return (
                    <button
                      type="button"
                      key={it.id}
                      data-idx={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={it.onSelect}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        isActive ? 'bg-violet-50 text-violet-900' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span
                        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                          isActive ? 'bg-white text-violet-600' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon name={it.icon} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{it.label}</p>
                        {it.hint ? <p className="text-xs text-slate-500 truncate">{it.hint}</p> : null}
                      </div>
                      {isActive ? (
                        <kbd className="text-[10px] font-medium text-violet-500 px-1.5 py-0.5 rounded bg-white border border-violet-100">
                          Enter
                        </kbd>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2 text-[10px] text-slate-400 bg-slate-50/60 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">↓</kbd>
            <span>navegar</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">Enter</kbd>
            <span>abrir</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200">K</kbd>
            <span>abrir busca</span>
          </div>
        </div>
      </div>
    </div>
  )
}
