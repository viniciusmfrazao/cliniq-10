export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-32 bg-slate-100 dark:bg-slate-900 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm">
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded mb-3" />
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm">
        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800 rounded-full" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
