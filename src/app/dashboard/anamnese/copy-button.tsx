'use client'

export default function CopyLinkButton({ token }: { token: string }) {
  return (
    <button
      onClick={() => {
        const url = `${window.location.origin}/anamnese/${token}`
        navigator.clipboard.writeText(url)
        alert('Link copiado!')
      }}
      className="text-slate-600 hover:text-slate-900 text-sm"
    >
      Copiar link
    </button>
  )
}
