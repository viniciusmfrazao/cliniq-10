export default function BrandedLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <img
        src="/logo.svg"
        alt="Clinike"
        className="w-16 h-16 rounded-2xl animate-[pulse_1.4s_ease-in-out_infinite]"
      />
    </div>
  )
}
