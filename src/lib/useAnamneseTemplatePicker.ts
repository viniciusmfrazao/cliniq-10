'use client'

import { useState } from 'react'

export type TemplateOption = { id: string; nome: string; ativo: boolean }

export type AnamneseOptions = {
  /** Ficha padrão (fixa) está ativa pra essa clínica */
  padraoAtiva: boolean
  /** Modelos customizados ativos */
  templates: TemplateOption[]
}

/**
 * Carrega (uma vez, lazy) as fichas disponíveis pra envio: a ficha padrão
 * (se a clínica não desativou) + os modelos customizados ativos.
 *
 * Usado nos 3 pontos de envio de anamnese (agenda, enviar, presencial) pra
 * decidir se mostra um seletor ou manda direto quando só existe 1 opção.
 */
export function useAnamneseTemplatePicker() {
  const [cache, setCache] = useState<AnamneseOptions | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadOptions(): Promise<AnamneseOptions> {
    if (cache !== null) return cache

    setLoading(true)
    try {
      const r = await fetch('/api/anamnese/templates')
      if (r.ok) {
        const data = await r.json()
        const list: TemplateOption[] = (data.templates || []).map((t: any) => ({
          id: t.id,
          nome: t.nome,
          ativo: t.ativo,
        }))
        const result: AnamneseOptions = {
          padraoAtiva: data.padraoAtiva !== false,
          templates: list.filter((t) => t.ativo),
        }
        setCache(result)
        return result
      }
    } catch {
      // segue pro fallback abaixo
    } finally {
      setLoading(false)
    }

    // Fallback seguro: se não deu pra carregar, assume só a ficha padrão.
    const fallback: AnamneseOptions = { padraoAtiva: true, templates: [] }
    setCache(fallback)
    return fallback
  }

  return { loadOptions, loading }
}

/**
 * Decide se dá pra mandar direto (só existe 1 opção) ou se precisa
 * perguntar qual ficha usar. Retorna `null` quando precisa perguntar.
 */
export function resolveAutoTemplateId(options: AnamneseOptions): { auto: true; templateId: string | null } | { auto: false } {
  const totalOptions = (options.padraoAtiva ? 1 : 0) + options.templates.length

  if (totalOptions <= 1) {
    // Só a padrão, só 1 modelo, ou (caso defensivo) nenhuma opção -> manda
    // com o que tiver disponível, sem perguntar.
    if (options.padraoAtiva) return { auto: true, templateId: null }
    if (options.templates.length === 1) return { auto: true, templateId: options.templates[0].id }
    return { auto: true, templateId: null } // defensivo: nunca deveria cair aqui
  }

  return { auto: false }
}
