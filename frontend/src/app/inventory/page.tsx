import { getSets } from "@/lib/api";
import { AddSetDialog } from "@/components/add-set-dialog";
import { ManageSetDialog } from "@/components/manage-set-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type LegoSet = { id: number, product_id: string, name: string, theme: string, buy_price: number, current_price: number, target_price: number | null, condition: string, notes: string | null, image_url: string | null, status: string };

export default async function InventoryPage() {
  let sets: LegoSet[] = [];
  try {
    sets = await getSets();
  } catch (e) {
    console.error("Could not fetch inventory", e);
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventario</h2>
          <p className="text-muted-foreground mt-1">
            Gestiona tus sets de LEGO y registra tus ventas.
          </p>
        </div>
        <AddSetDialog />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID Set</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tema & Condición</TableHead>
              <TableHead className="text-right">P. Compra</TableHead>
              <TableHead className="text-right">Mercado / Target</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No hay sets en el inventario. ¡Añade tu primer set!
                </TableCell>
              </TableRow>
            ) : (
              sets.map((legoSet: LegoSet) => {
                const reachedTarget = legoSet.target_price && legoSet.current_price && legoSet.current_price >= legoSet.target_price;
                
                return (
                <TableRow key={legoSet.id} className={reachedTarget ? "bg-success/5" : ""}>
                  <TableCell className="font-medium text-primary">#{legoSet.product_id}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {/* image_url could be used here in the future as an avatar */}
                      <span>{legoSet.name}</span>
                      {reachedTarget && (
                        <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" title="¡Objetivo Alcanzado!" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{legoSet.theme || "-"}</span>
                      <span className="text-xs text-muted-foreground">{legoSet.condition}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">€{legoSet.buy_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className={`font-medium ${reachedTarget ? "text-success" : "text-muted-foreground"}`}>
                        {legoSet.current_price ? `€${legoSet.current_price.toFixed(2)}` : "-"}
                      </span>
                      {legoSet.target_price && (
                        <span className="text-xs text-muted-foreground">Target: €{legoSet.target_price.toFixed(2)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={legoSet.status === "IN_STOCK" ? "default" : "secondary"}>
                      {legoSet.status === "IN_STOCK" ? "EN STOCK" : legoSet.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ManageSetDialog set={legoSet} />
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
