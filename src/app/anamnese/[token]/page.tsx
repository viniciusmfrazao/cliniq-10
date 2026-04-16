import AnamneseFormClient from './anamnese-form-client'

export const metadata = {
  title: 'Ficha de Anamnese',
}

export default function AnamnesePage({ params }: { params: { token: string } }) {
  return <AnamneseFormClient token={params.token} />
}
