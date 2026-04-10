import Icon from '@/components/ui/Icon'
import Link from 'next/link'

type Props = {
  patient: {
    id: string
    name: string
    phone: string | null
    email: string | null
    birth_date: string | null
    photo_url: string | null
  }
  procedure: {
    name: string
    duration_minutes: number
    price: number
  } | null
}

export default function PatientInfo({ patient, procedure }: Props) {
  const age = patient.birth_date 
    ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000)
    : null

  return (
    <div className="card p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Foto e info basica */}
        <div className="flex items-center gap-4">
          {patient.photo_url ? (
            <img 
              src={patient.photo_url} 
              alt={patient.name}
              className="w-20 h-20 rounded-2xl object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {patient.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-900">{patient.name}</h2>
            {age && <p className="text-sm text-slate-500">{age} anos</p>}
            <div className="flex gap-2 mt-2">
              {patient.phone && (
                <a 
                  href={`https://wa.me/55${patient.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100"
                >
                  <Icon name="phone" className="w-3 h-3" />
                  WhatsApp
                </a>
              )}
              <Link 
                href={`/dashboard/pacientes/${patient.id}`}
                className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg hover:bg-slate-200"
              >
                <Icon name="user" className="w-3 h-3" />
                Ver ficha
              </Link>
            </div>
          </div>
        </div>

        {/* Procedimento */}
        {procedure && (
          <div className="flex-1 md:border-l md:border-slate-100 md:pl-6">
            <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Procedimento</p>
            <p className="text-lg font-bold text-slate-900">{procedure.name}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Icon name="clock" className="w-4 h-4" />
                {procedure.duration_minutes} min
              </span>
              <span className="flex items-center gap-1">
                <Icon name="dollar" className="w-4 h-4" />
                {procedure.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        )}

        {/* Contatos rapidos */}
        <div className="flex flex-col gap-2 md:border-l md:border-slate-100 md:pl-6">
          {patient.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Icon name="phone" className="w-4 h-4 text-slate-400" />
              {patient.phone}
            </div>
          )}
          {patient.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Icon name="mail" className="w-4 h-4 text-slate-400" />
              {patient.email}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
