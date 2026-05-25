export const dynamic = 'force-dynamic';
import { getSets } from "@/lib/api";
import { AddSetDialog } from "@/components/add-set-dialog";
import { InventoryClientTable } from "@/components/inventory-client-table";

type LegoSet = { id: number, product_id: string, name: string, theme: string, buy_price: number, current_price: number, condition: string, notes: string | null, image_url: string | null, status: string, msrp: number | null, year_eol: string | null };

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

      <InventoryClientTable sets={sets} />
    </div>
  );
}
