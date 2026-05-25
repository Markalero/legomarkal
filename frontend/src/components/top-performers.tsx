"use client"

import { useRouter } from "next/navigation"


type TopPerformer = {
  id: number
  product_id: string
  name: string
  image_url: string | null
  buy_price: number
  current_price: number
  roi_percentage: number
}

export function TopPerformersCarousel({ performers }: { performers: TopPerformer[] }) {
  const router = useRouter()

  if (!performers || performers.length === 0) {
    return (
      <div className="w-full p-4 rounded-lg bg-background/40 border text-center text-muted-foreground text-sm">
        Aún no hay datos de ROI disponibles en tu inventario.
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-3">
      {performers.map((p, index) => (
        <div 
          key={p.product_id} 
          onClick={() => router.push(`/inventory/${p.id}`)}
          className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors border bg-background/50 cursor-pointer group"
        >
          <div className="text-xl font-bold text-muted-foreground w-6 text-center group-hover:text-primary transition-colors">
            {index + 1}
          </div>
          <div className="h-12 w-12 rounded bg-white p-1 flex-shrink-0 flex items-center justify-center border">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="object-contain w-full h-full group-hover:scale-110 transition-transform duration-300" />
            ) : (
              <span className="text-[10px] text-muted-foreground">No img</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-bold text-foreground truncate mr-2">{p.name}</span>
              <span className={`text-sm font-bold shrink-0 ${p.roi_percentage >= 0 ? 'text-success' : 'text-destructive'}`}>
                {p.roi_percentage >= 0 ? '+' : ''}{p.roi_percentage.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">#{p.product_id}</span>
              <span className="text-muted-foreground font-medium">
                ({p.current_price - p.buy_price >= 0 ? '+' : ''}€{(p.current_price - p.buy_price).toFixed(2)})
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
