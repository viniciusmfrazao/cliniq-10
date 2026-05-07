'use client'

type Props = {
  data: { day: string; count: number }[]
  color?: string
}

export default function WeeklyChart({ data, color = '#8B5CF6' }: Props) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="grid grid-cols-7 gap-2">
      {data.map((item, idx) => {
        const heightPct = item.count > 0
          ? Math.max((item.count / maxCount) * 100, 8)
          : 4
        const isToday = idx === data.length - 1

        return (
          <div key={`${item.day}-${idx}`} className="flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-600 mb-1">
              {item.count}
            </span>
            <div className="w-full h-24 flex flex-col justify-end">
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${
                  isToday ? 'opacity-100 shadow-md' : 'opacity-60'
                }`}
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: color,
                  minHeight: 4,
                }}
              />
            </div>
            <span className={`text-[10px] font-medium mt-1.5 ${
              isToday ? 'text-slate-900 font-bold' : 'text-slate-500'
            }`}>
              {item.day}
            </span>
          </div>
        )
      })}
    </div>
  )
}
