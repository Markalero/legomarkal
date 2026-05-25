"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ManageSetDialog } from "@/components/manage-set-dialog";
import { EditSetDialog } from "@/components/edit-set-dialog";
import { DeleteSetDialog } from "@/components/delete-set-dialog";
import { Search, Grid, List, ArrowUpDown, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";

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
  sales?: { sell_price: number, sell_date: string }[];
};

type SortColumn = "id" | "name" | "buy_price" | "current_price" | "roi";
type SortDirection = "asc" | "desc";

export function InventoryClientTable({ sets }: { sets: LegoSet[] }) {
  const router = useRouter();
  
  // States
  const [searchTerm, setSearchTerm] = useState("");
  
  // Initialize from localStorage if available, otherwise default
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  
  const [sortCol, setSortCol] = useState<SortColumn>("id");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Load saved preferences on mount
  useEffect(() => {
    const savedFilter = localStorage.getItem("legoFilterStatus");
    if (savedFilter) setFilterStatus(savedFilter);
    
    const savedViewMode = localStorage.getItem("legoViewMode") as "table" | "grid";
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  // Save preferences on change
  useEffect(() => {
    localStorage.setItem("legoFilterStatus", filterStatus);
  }, [filterStatus]);

  useEffect(() => {
    localStorage.setItem("legoViewMode", viewMode);
  }, [viewMode]);

  // Handlers
  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const renderSortIcon = (col: SortColumn) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  // Memoized Processing
  const processedSets = useMemo(() => {
    let result = [...sets];

    // 1. Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(lowerTerm) || 
        s.product_id.toLowerCase().includes(lowerTerm)
      );
    }

    // 2. Filter Status
    if (filterStatus !== "ALL") {
      result = result.filter(s => s.status === filterStatus);
    }

    // 3. Sort
    result.sort((a, b) => {
      let aVal: string | number | null = a[sortCol as keyof LegoSet] as string | number | null;
      let bVal: string | number | null = b[sortCol as keyof LegoSet] as string | number | null;

      if (sortCol === "roi") {
        aVal = a.buy_price && a.current_price ? ((a.current_price - a.buy_price) / a.buy_price) : 0;
        bVal = b.buy_price && b.current_price ? ((b.current_price - b.buy_price) / b.buy_price) : 0;
      }

      if (aVal === null) aVal = "";
      if (bVal === null) bVal = "";

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [sets, searchTerm, filterStatus, sortCol, sortDir]);

  const currentYear = new Date().getFullYear().toString();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por ID o nombre..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 px-3 py-2 rounded-md border bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring flex-1 sm:flex-none"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="IN_STOCK">En Stock</option>
            <option value="SOLD">Vendidos</option>
          </select>

          <div className="flex items-center border rounded-md overflow-hidden shrink-0">
            <Button 
              variant="ghost" 
              className={`rounded-none px-3 gap-2 ${viewMode === 'table' ? 'bg-secondary' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Tabla</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`rounded-none px-3 gap-2 ${viewMode === 'grid' ? 'bg-secondary' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
              <span className="hidden sm:inline">Cuadrícula</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content View */}
      {processedSets.length === 0 ? (
        <div className="p-8 text-center bg-card border rounded-lg text-muted-foreground">
          No se encontraron resultados para tu búsqueda.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {processedSets.map(legoSet => {
            const isSold = legoSet.status === "SOLD";
            const currentOrSoldPrice = isSold && legoSet.sales && legoSet.sales.length > 0 
              ? legoSet.sales[0].sell_price 
              : legoSet.current_price;
            
            const roi = legoSet.buy_price && currentOrSoldPrice ? ((currentOrSoldPrice - legoSet.buy_price) / legoSet.buy_price) * 100 : 0;
            const absoluteProfit = currentOrSoldPrice ? currentOrSoldPrice - legoSet.buy_price : 0;
            const hasProfit = absoluteProfit > 0;
            const isEOL = legoSet.year_eol && legoSet.year_eol.includes(currentYear);

            return (
              <Card key={legoSet.id} className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group animate-in fade-in zoom-in-95 duration-500" onClick={() => router.push(`/inventory/${legoSet.id}`)}>
                <div className="h-48 bg-white p-4 flex items-center justify-center relative">
                  {isEOL && !isSold && (
                    <span className="absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20 animate-pulse">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      EOL {currentYear}
                    </span>
                  )}
                  {legoSet.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={legoSet.image_url} alt={legoSet.name} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <span className="text-muted-foreground">Sin Imagen</span>
                  )}
                  <span className={`absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${isSold ? 'bg-muted text-muted-foreground border border-muted-foreground/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                    {isSold ? "VENDIDO" : "EN STOCK"}
                  </span>
                </div>
                <CardContent className="p-4 bg-card border-t flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">#{legoSet.product_id} • {legoSet.condition}</div>
                    <h3 className="font-bold text-sm truncate mb-3">{legoSet.name}</h3>
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Inversión</p>
                        <p className="font-semibold">€{legoSet.buy_price.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{isSold ? "Vendido por" : "Mercado"}</p>
                        <p className={`font-bold ${isSold ? 'text-primary' : 'text-foreground'}`}>
                          {currentOrSoldPrice ? `€${currentOrSoldPrice.toFixed(2)}` : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className={`p-3 mb-4 rounded-md border flex justify-between items-center text-sm font-bold ${hasProfit ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider opacity-70">Beneficio Neto</span>
                        <span className="text-lg">{hasProfit ? '+' : ''}€{absoluteProfit.toFixed(2)}</span>
                      </div>
                      <span className="bg-background/50 px-2 py-1 rounded text-xs">{hasProfit ? '+' : ''}{roi.toFixed(1)}%</span>
                    </div>
                    <div className="pt-3 border-t flex justify-between items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <div className="opacity-70 hover:opacity-100 transition-opacity"><EditSetDialog set={legoSet} /></div>
                      <div className="flex-1 flex justify-center"><ManageSetDialog set={legoSet} /></div>
                      <div className="opacity-50 hover:opacity-100 transition-opacity"><DeleteSetDialog set={legoSet} /></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("id")}>
                  <div className="flex items-center gap-1">ID Set {renderSortIcon("id")}</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">Nombre {renderSortIcon("name")}</div>
                </TableHead>
                <TableHead>Tema & Condición</TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("buy_price")}>
                  <div className="flex items-center justify-end gap-1">P. Compra {renderSortIcon("buy_price")}</div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("current_price")}>
                  <div className="flex items-center justify-end gap-1">V. Mercado {renderSortIcon("current_price")}</div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("roi")}>
                  <div className="flex items-center justify-end gap-1">Beneficio {renderSortIcon("roi")}</div>
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedSets.map((legoSet, index) => {
                const isSold = legoSet.status === "SOLD";
                const currentOrSoldPrice = isSold && legoSet.sales && legoSet.sales.length > 0 
                  ? legoSet.sales[0].sell_price 
                  : legoSet.current_price;
                
                const roi = currentOrSoldPrice && legoSet.buy_price 
                  ? ((currentOrSoldPrice - legoSet.buy_price) / legoSet.buy_price) * 100 
                  : 0;
                const absoluteProfit = currentOrSoldPrice ? currentOrSoldPrice - legoSet.buy_price : 0;
                const hasProfit = absoluteProfit > 0;
                const isEOL = legoSet.year_eol && legoSet.year_eol.includes(currentYear);

                return (
                  <TableRow 
                    key={legoSet.id} 
                    className="cursor-pointer transition-colors hover:bg-secondary/40 group block md:table-row mb-4 md:mb-0 border md:border-0 rounded-lg md:rounded-none bg-card animate-in fade-in slide-in-from-bottom-2 duration-500"
                    style={{ animationFillMode: "both", animationDelay: `${index * 50}ms` }}
                    onClick={() => router.push(`/inventory/${legoSet.id}`)}
                  >
                    <TableCell className="font-medium text-primary block md:table-cell border-b md:border-0">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden font-bold text-muted-foreground">ID:</span>
                        #{legoSet.product_id}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium block md:table-cell border-b md:border-0">
                      <div className="flex items-center gap-3">
                        {legoSet.image_url && (
                          <div className="w-12 h-12 rounded overflow-hidden bg-white/5 shrink-0 flex items-center justify-center p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={legoSet.image_url} alt={legoSet.name} className="max-w-full max-h-full object-contain" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="truncate max-w-[200px] sm:max-w-xs">{legoSet.name}</span>
                          {isEOL && !isSold && (
                            <span className="text-[10px] text-destructive font-bold flex items-center gap-1 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                              EOL {currentYear}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="block md:table-cell border-b md:border-0">
                      <div className="flex justify-between md:flex-col">
                        <span className="md:hidden font-bold text-muted-foreground">Tema:</span>
                        <div className="flex flex-col items-end md:items-start">
                          <span className="truncate max-w-[150px]">{legoSet.theme || "-"}</span>
                          <span className="text-xs text-muted-foreground">{legoSet.condition}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right block md:table-cell border-b md:border-0">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden font-bold text-muted-foreground">Inversión:</span>
                        €{legoSet.buy_price.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right block md:table-cell border-b md:border-0">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden font-bold text-muted-foreground">{isSold ? "Vendido" : "Mercado"}:</span>
                        <span className={`font-bold ${isSold ? 'text-primary' : ''}`}>
                          {currentOrSoldPrice ? `€${currentOrSoldPrice.toFixed(2)}` : "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right block md:table-cell border-b md:border-0">
                      <div className="flex justify-between md:flex-col md:items-end">
                        <span className="md:hidden font-bold text-muted-foreground">Beneficio:</span>
                        <div className="flex flex-col items-end">
                          <span className={`font-bold ${hasProfit ? 'text-success' : 'text-destructive'}`}>
                            {hasProfit ? '+' : ''}€{absoluteProfit.toFixed(2)}
                          </span>
                          <span className={`text-[10px] ${hasProfit ? 'text-success/80' : 'text-destructive/80'}`}>
                            {hasProfit ? '+' : ''}{roi.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="block md:table-cell border-b md:border-0">
                      <div className="flex justify-between md:block items-center">
                        <span className="md:hidden font-bold text-muted-foreground">Estado:</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${legoSet.status === "IN_STOCK" ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-muted-foreground/20'}`}>
                          {legoSet.status === "IN_STOCK" ? "EN STOCK" : legoSet.status.replace("_", " ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right block md:table-cell bg-muted/20 md:bg-transparent">
                      <div 
                        className="flex justify-center md:justify-end gap-2 items-center py-2 md:py-0" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DeleteSetDialog set={legoSet} />
                        <EditSetDialog set={legoSet} />
                        <ManageSetDialog set={legoSet} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
