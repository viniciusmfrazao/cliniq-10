'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/nav'
import Icon from '@/components/ui/Icon'
import NotificationBell from '@/components/ui/NotificationBell'
import { createClient } from '@/lib/supabase/client'
import { isRouteEnabled, type ModuleId } from '@/lib/modules'

type Props = { 
  clinicName: string
  userName: string
  userRole: string
  trialDaysLeft: number
  userId?: string
  activeModules?: ModuleId[]
}

export default function Sidebar({ clinicName, userName, userRole, trialDaysLeft, userId, activeModules = [] }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  // Filtra por role E por módulos ativos (se houver módulos configurados)
  const nav = NAV_ITEMS.filter(i => {
    // Primeiro verifica se o usuário tem a role necessária
    if (!i.roles.includes(userRole)) return false
    
    // Se não há módulos configurados, libera tudo (compatibilidade)
    if (activeModules.length === 0) return true
    
    // Verifica se a rota está habilitada pelos módulos
    return isRouteEnabled(i.href, activeModules)
  })
  const isActive = (href: string) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)
  
  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const expanded: string[] = []
    nav.forEach(item => {
      if (item.children && pathname.startsWith(item.href)) {
        expanded.push(item.href)
      }
    })
    return expanded
  })

  const toggleMenu = (href: string) => {
    setExpandedMenus(prev => 
      prev.includes(href) 
        ? prev.filter(h => h !== href)
        : [...prev, href]
    )
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex flex-col w-72 sidebar-gradient h-screen flex-shrink-0 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-20 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-1/2" />
      
      {/* Logo */}
      <div className="px-6 py-6 relative">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-lg animate-pulse-glow">
            <span className="text-white text-xl font-black">C</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-lg truncate">{clinicName}</p>
            <p className="text-white/50 text-xs font-medium">Clinike</p>
          </div>
        </div>
      </div>

      {/* Trial Banner - DESATIVADO POR ENQUANTO
      {trialDaysLeft > 0 && trialDaysLeft <= 14 && (
        <div className="mx-4 mb-4 px-4 py-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center animate-float">
              <Icon name="zap" className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold">{trialDaysLeft} dias restantes</p>
              <Link href="/planos" className="text-xs text-white/70 hover:text-white">
                Fazer upgrade →
              </Link>
            </div>
          </div>
        </div>
      )}
      */}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 overflow-y-auto space-y-1">
        {nav.map((item, idx) => {
          const active = isActive(item.href)
          const hasChildren = item.children && item.children.length > 0
          const isExpanded = expandedMenus.includes(item.href)

          if (hasChildren) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => toggleMenu(item.href)}
                  className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${
                    active 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    active 
                      ? 'gradient-bg shadow-lg' 
                      : 'bg-white/10 group-hover:bg-white/20'
                  }`}>
                    <Icon 
                      name={item.icon} 
                      className={`w-5 h-5 ${active ? 'text-white' : 'text-white/80'}`} 
                    />
                  </div>
                  <span className="flex-1 text-left">{item.label}</span>
                  <Icon 
                    name={isExpanded ? 'chevronDown' : 'chevronRight'} 
                    className="w-4 h-4 text-white/50 transition-transform"
                  />
                </button>
                
                {isExpanded && (
                  <div className="mt-1 ml-6 pl-4 border-l border-white/20 space-y-1">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.href
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-4 py-2 rounded-xl text-sm transition-all ${
                            childActive
                              ? 'bg-white text-slate-900 font-semibold shadow-md'
                              : 'text-white/60 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${
                active 
                  ? 'bg-white text-slate-900 shadow-lg' 
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                active 
                  ? 'gradient-bg shadow-lg' 
                  : 'bg-white/10 group-hover:bg-white/20'
              }`}>
                <Icon 
                  name={item.icon} 
                  className={`w-5 h-5 ${active ? 'text-white' : 'text-white/80'}`} 
                />
              </div>
              <span className="flex-1">{item.label}</span>
              {item.label === 'Eva IA' && (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                  active ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white/20 text-white'
                }`}>
                  IA
                </span>
              )}
              {active && (
                <div className="w-2 h-2 rounded-full gradient-bg animate-pulse-glow" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/5 backdrop-blur-xl">
          <div className="w-11 h-11 gradient-bg rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-xs text-white/50 capitalize">{userRole}</p>
          </div>
          <div className="flex items-center gap-1">
            {userId && (
              <div className="[&_button]:text-white/50 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
                <NotificationBell userId={userId} />
              </div>
            )}
            <button 
              onClick={logout} 
              className="p-2.5 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all" 
              title="Sair"
            >
              <Icon name="logout" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
