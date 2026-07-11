export default function PacientesLoading() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-6 w-28 bg-slate-200 rounded-lg" />
          <div className="h-3 w-36 bg-slate-100 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
      </div>

      {/* Search */}
      <div className="h-10 w-full bg-slate-100 rounded-xl mb-4" />

      {/* List */}
      <div className="bg-white rounded-2xl divide-y divide-slate-100 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
            <div className="h-6 w-16 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
