export default function FinanceiroLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 bg-slate-200 rounded-lg" />
          <div className="h-4 w-44 bg-slate-100 rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-xl" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="h-3 w-16 bg-slate-100 rounded mb-3" />
            <div className="h-6 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Chart / table area */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="h-5 w-32 bg-slate-200 rounded mb-6" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="flex-1 h-3 bg-slate-100 rounded-full" />
              <div className="h-4 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
