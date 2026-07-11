export default function EstoqueLoading() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-6 w-24 bg-slate-200 rounded-lg" />
          <div className="h-3 w-36 bg-slate-100 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4">
            <div className="h-3 w-16 bg-slate-100 rounded mb-2" />
            <div className="h-6 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl divide-y divide-slate-100 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
            <div className="h-4 w-12 bg-slate-100 rounded" />
            <div className="h-6 w-16 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
