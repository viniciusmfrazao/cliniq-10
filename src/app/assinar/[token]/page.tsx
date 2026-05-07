import SignaturePageClient from './signature-page-client'

export default function AssinarPage({ params }: { params: { token: string } }) {
  return <SignaturePageClient token={params.token} />
}
