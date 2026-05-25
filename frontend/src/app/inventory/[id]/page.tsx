import { getSet } from "@/lib/api";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Tags, Package, DollarSign, Activity } from "lucide-react";
import Link from "next/link";
import { EditSetDialog } from "@/components/edit-set-dialog";
import { DeleteSetDialog } from "@/components/delete-set-dialog";
import { ManageSetDialog } from "@/components/manage-set-dialog";

import { EditSaleDialog } from "@/components/edit-sale-dialog";
import { UndoSaleDialog } from "@/components/undo-sale-dialog";

export const dynamic = 'force-dynamic';

export default async function SetDetailsPage({ params }: { params: { id: string } }) {
  let set = null;
  try {
    set = await getSet(params.id);
  } catch (e) {
    console.error("Could not fetch set details", e);
  }

  if (!set) {
    notFound();
  }

  const roi = set.current_price && set.buy_price 
    ? ((set.current_price - set.buy_price) / set.buy_price) * 100 
    : 0;
  const hasProfit = roi >= 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight">{set.name}</h2>
            <Badge variant="outline" className="text-sm font-medium">#{set.product_id}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            {set.theme} • Añadido el {new Date(set.purchase_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeleteSetDialog set={set} />
          <EditSetDialog set={set} />
          {set.status === "IN_STOCK" && (
            <ManageSetDialog set={set} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Image & Main Info */}
        <div className="space-y-6">
          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden">
            <div className="aspect-square bg-white/5 flex items-center justify-center p-6">
              {set.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={set.image_url} alt={set.name} className="w-full h-full object-contain" />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center">
                  <Package className="h-12 w-12 mb-2 opacity-20" />
                  <span>Sin imagen</span>
                </div>
              )}
            </div>
            <CardContent className="p-4 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Estado</p>
                <Badge variant={set.status === "IN_STOCK" ? "default" : "secondary"}>
                  {set.status === "IN_STOCK" ? "EN STOCK" : set.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Tags className="h-3 w-3" /> Condición</p>
                <p className="font-medium text-sm">{set.condition}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Año / EOL</p>
                <p className="font-medium text-sm">{set.year_eol || "-"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> PVP Orig.</p>
                <p className="font-medium text-sm">{set.msrp ? `€${set.msrp.toFixed(2)}` : "-"}</p>
              </div>
            </CardContent>
          </Card>

          {set.notes && (
            <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notas del Producto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{set.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Financials & History */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-1">Inversión (Compra)</p>
                <div className="text-3xl font-bold">€{set.buy_price.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className={`bg-background/60 backdrop-blur-xl shadow-xl relative overflow-hidden ${hasProfit ? 'border-success/30' : 'border-destructive/30'}`}>
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full -z-10 ${hasProfit ? 'bg-success/10' : 'bg-destructive/10'}`} />
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-1">Valor de Mercado</p>
                <div className="flex items-baseline gap-2">
                  <div className={`text-3xl font-bold ${hasProfit ? 'text-success' : 'text-destructive'}`}>
                    {set.current_price ? `€${set.current_price.toFixed(2)}` : "-"}
                  </div>
                  <span className={`text-sm font-medium ${hasProfit ? 'text-success/80' : 'text-destructive/80'}`}>
                    {hasProfit ? '+' : ''}{roi.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> Historial de Precios
              </CardTitle>
              <CardDescription>Evolución del valor de mercado de este set.</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] flex items-center justify-center border-t border-white/5 m-6 rounded-md bg-black/5">
              <p className="text-sm text-muted-foreground">El gráfico estará disponible una vez haya suficientes datos históricos.</p>
            </CardContent>
          </Card>

          {set.sales && set.sales.length > 0 && (
            <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl">
              <CardHeader>
                <CardTitle>Historial de Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {set.sales.map((sale: { id: number, sell_price: number, platform: string | null, sold_at: string, receipt_url: string | null }) => (
                    <div key={sale.id} className="flex justify-between items-center p-3 rounded-lg border border-white/10 bg-white/5">
                      <div>
                        <p className="font-medium text-sm">Vendido por €{sale.sell_price.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{sale.platform || 'Sin plataforma'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{new Date(sale.sold_at).toLocaleDateString()}</p>
                        {sale.receipt_url && (
                          <a href={sale.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                            Ver Recibo
                          </a>
                        )}
                        <div className="flex gap-1 mt-2 justify-end">
                          <EditSaleDialog sale={sale} />
                          <UndoSaleDialog sale={sale} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
