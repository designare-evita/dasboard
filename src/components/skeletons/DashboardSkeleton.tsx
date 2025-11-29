import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <div className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* 1. Header Bereich (Titel + DatePicker) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" /> {/* Titel */}
            <Skeleton className="h-4 w-64" /> {/* Subtitel/Domain */}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" /> {/* DatePicker */}
            <Skeleton className="h-10 w-10" /> {/* Export Button */}
          </div>
        </div>

        {/* 2. AI Widget Placeholder */}
        <Skeleton className="h-32 w-full rounded-xl" />

        {/* 3. KPI Grid (Die kleinen Karten oben) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>

        {/* 4. Trend Chart (Großer Graph) */}
        <Skeleton className="h-[400px] w-full rounded-xl" />

        {/* 5. Split Grid (AI Traffic + Queries) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Skeleton className="h-[500px] xl:col-span-1 rounded-xl" />
          <Skeleton className="h-[500px] xl:col-span-2 rounded-xl" />
        </div>

        {/* 6. Pie Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>

      </div>
    </div>
  )
}
