import { getSets } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackagePlus } from "lucide-react";

export default async function InventoryPage() {
  let sets = [];
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
        <Button className="gap-2">
          <PackagePlus className="w-4 h-4" />
          Añadir Set
        </Button>
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
              sets.map((legoSet: any) => (
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
                    <Button variant="outline" size="sm">
                      Gestionar
                    </Button>
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
