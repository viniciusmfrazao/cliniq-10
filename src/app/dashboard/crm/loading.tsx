export default function CRMLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-6 w-16 bg-slate-200 rounded-lg" />
          <div className="h-3 w-40 bg-slate-100 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        <div className="h-9 w-28 bg-slate-100 rounded-lg" />
        <div className="h-9 w-28 bg-slate-100 rounded-lg" />
        <div className="h-9 w-28 bg-slate-100 rounded-lg" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-hidden">
        {[...Array(5)].map((_, col) => (
          <div key={col} className="flex-1 min-w-[220px] bg-slate-50 rounded-2xl p-3">
            <div className="h-4 w-20 bg-slate-200 rounded mb-3" />
            <div className="space-y-2">
              {[...Array(3)].map((_, card) => (
                <div key={card} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="h-4 w-28 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
