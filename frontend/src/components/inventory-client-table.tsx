"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ManageSetDialog } from "@/components/manage-set-dialog";
import { EditSetDialog } from "@/components/edit-set-dialog";
import { DeleteSetDialog } from "@/components/delete-set-dialog";

type LegoSet = {
  id: number;
  product_id: string;
  name: string;
  theme: string;
  buy_price: number;
  current_price: number;
  condition: string;
  notes: string | null;
  image_url: string | null;
  status: string;
  msrp: number | null;
  year_eol: string | null;
};

export function InventoryClientTable({ sets }: { sets: LegoSet[] }) {
  const router = useRouter();

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">ID Set</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Tema & Condición</TableHead>
            <TableHead className="text-right">P. Compra</TableHead>
            <TableHead className="text-right">Valor Mercado</TableHead>
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
            sets.map((legoSet) => {
              const roi = legoSet.current_price && legoSet.buy_price 
                ? ((legoSet.current_price - legoSet.buy_price) / legoSet.buy_price) * 100 
                : 0;
              const hasProfit = roi > 0;

              return (
                <TableRow 
                  key={legoSet.id} 
                  className={`cursor-pointer transition-colors hover:bg-muted/50`}
                  onClick={() => router.push(`/inventory/${legoSet.id}`)}
                >
                  <TableCell className="font-medium text-primary">#{legoSet.product_id}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {legoSet.image_url && (
                        <div className="w-10 h-10 rounded overflow-hidden bg-white/5 shrink-0 flex items-center justify-center p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={legoSet.image_url} alt={legoSet.name} className="max-w-full max-h-full object-contain" />
                        </div>
                      )}
                      <span>{legoSet.name}</span>
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
                      <span className={`font-medium ${hasProfit ? "text-success" : "text-foreground"}`}>
                        {legoSet.current_price ? `€${legoSet.current_price.toFixed(2)}` : "-"}
                      </span>
                      {hasProfit && (
                        <span className="text-xs text-success/80">+{roi.toFixed(1)}%</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={legoSet.status === "IN_STOCK" ? "default" : "secondary"}>
                      {legoSet.status === "IN_STOCK" ? "EN STOCK" : legoSet.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div 
                      className="flex justify-end gap-2 items-center" 
                      onClick={(e) => e.stopPropagation()} // Prevent row click when clicking actions
                    >
                      <DeleteSetDialog set={legoSet} />
                      <EditSetDialog set={legoSet} />
                      <ManageSetDialog set={legoSet} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
