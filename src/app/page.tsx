import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/landing/LandingPage'

export const metadata = {
  title: 'Clinike - Sistema de Gestão para Clínicas de Estética',
  description: 'O sistema mais completo para gestão de clínicas de estética. Agenda, pacientes, financeiro, CRM, estoque e muito mais. Teste grátis por 14 dias.',
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Se já logado, vai para dashboard
  if (user) {
    redirect('/dashboard')
  }
  
  // Se não logado, mostra landing page
  return <LandingPage />
}
