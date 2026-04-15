import { notFound } from 'next/navigation'
import SignaturePageClient from './signature-page-client'

export default async function AssinarPage({ params }: { params: { token: string } }) {
  return <SignaturePageClient token={params.token} />
}
