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

type LegoSet = { id: number, product_id: string, name: string, theme: string, buy_price: number, current_price: number, status: string };

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
              <TableHead>Tema</TableHead>
              <TableHead className="text-right">P. Compra</TableHead>
              <TableHead className="text-right">Mercado Actual</TableHead>
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
              sets.map((legoSet: LegoSet) => (
                <TableRow key={legoSet.id}>
                  <TableCell className="font-medium text-primary">#{legoSet.product_id}</TableCell>
                  <TableCell className="font-medium">{legoSet.name}</TableCell>
                  <TableCell>{legoSet.theme || "-"}</TableCell>
                  <TableCell className="text-right">€{legoSet.buy_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium text-success">
                    {legoSet.current_price ? `€${legoSet.current_price.toFixed(2)}` : "-"}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
