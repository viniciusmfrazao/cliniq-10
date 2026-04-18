'use client'

type Props = {
  data: { day: string; count: number }[]
  color?: string
}

export default function WeeklyChart({ data, color = '#8B5CF6' }: Props) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  
  return (
    <div className="flex items-end justify-between gap-1 h-32">
      {data.map((item, idx) => {
        const height = (item.count / maxCount) * 100
        const isToday = idx === data.length - 1
        
        return (
          <div key={item.day} className="flex flex-col items-center flex-1 gap-1">
            <span className="text-xs font-semibold text-slate-600 mb-1">
              {item.count}
            </span>
            <div 
              className={`w-full rounded-t-lg transition-all duration-500 ${
                isToday ? 'opacity-100' : 'opacity-60'
              }`}
              style={{ 
                height: `${Math.max(height, 4)}%`,
                backgroundColor: color,
              }}
            />
            <span className={`text-[10px] font-medium ${
              isToday ? 'text-slate-900' : 'text-slate-500'
            }`}>
              {item.day}
            </span>
          </div>
        )
      })}
    </div>
  )
}
