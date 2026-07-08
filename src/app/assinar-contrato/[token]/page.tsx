import ContractSignaturePageClient from './signature-page-client'

export default function AssinarContratoPage({ params }: { params: { token: string } }) {
  return <ContractSignaturePageClient token={params.token} />
}
