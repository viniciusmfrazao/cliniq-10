export default function AgendaLoading() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-24 bg-slate-200 rounded-lg" />
          <div className="h-4 w-44 bg-slate-100 rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl" />
            <div>
              <div className="h-7 w-10 bg-slate-200 rounded mb-1" />
              <div className="h-3 w-16 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="h-10 w-40 bg-slate-200 rounded-xl" />
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
      </div>

      {/* Calendar/List */}
      <div className="bg-white rounded-2xl p-6">
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
              <div className="h-12 w-16 bg-slate-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-28 bg-slate-100 rounded" />
              </div>
              <div className="h-8 w-24 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
