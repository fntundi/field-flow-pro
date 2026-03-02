import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Package, AlertTriangle, Truck, Shield } from "lucide-react";
import { useState } from "react";

const inventory = [
  { id: "ITEM-001", name: "Trane XR15 Condenser (3-ton)", category: "Equipment", vendor: "Trane", sku: "XR15-036", qty: 4, minQty: 2, price: "$2,400", warranty: "10 years", location: "Warehouse A" },
  { id: "ITEM-002", name: "Carrier 24ACC6 Condenser (2.5-ton)", category: "Equipment", vendor: "Carrier", sku: "24ACC630A003", qty: 2, minQty: 2, price: "$1,850", warranty: "10 years", location: "Warehouse A" },
  { id: "ITEM-003", name: "Honeywell T6 Pro Thermostat", category: "Parts", vendor: "Honeywell", sku: "TH6220U2000", qty: 18, minQty: 10, price: "$89", warranty: "5 years", location: "Van Stock" },
  { id: "ITEM-004", name: "R-410A Refrigerant (25 lb)", category: "Supplies", vendor: "Chemours", sku: "R410A-25", qty: 8, minQty: 5, price: "$185", warranty: "N/A", location: "Warehouse B" },
  { id: "ITEM-005", name: "16x25x4 MERV 13 Filter", category: "Supplies", vendor: "FilterBuy", sku: "FB16254M13", qty: 42, minQty: 20, price: "$24", warranty: "N/A", location: "Warehouse A" },
  { id: "ITEM-006", name: "Copeland Scroll Compressor (3-ton)", category: "Parts", vendor: "Emerson", sku: "ZR36K5E-PFV", qty: 1, minQty: 2, price: "$780", warranty: "5 years", location: "Warehouse B" },
  { id: "ITEM-007", name: "Evaporator Coil A-Frame (3-ton)", category: "Parts", vendor: "Goodman", sku: "CAPF3636B6", qty: 3, minQty: 2, price: "$420", warranty: "5 years", location: "Warehouse A" },
  { id: "ITEM-008", name: "Copper Line Set 3/8 x 3/4 (25ft)", category: "Supplies", vendor: "Mueller", sku: "LS38-34-25", qty: 6, minQty: 4, price: "$95", warranty: "N/A", location: "Van Stock" },
];

const Inventory = () => {
  const [search, setSearch] = useState("");
  const filtered = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.vendor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Asset tracking, vendors, and warranty data</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Items", value: "342", icon: Package },
          { label: "Low Stock", value: "3", icon: AlertTriangle },
          { label: "Vendors", value: "24", icon: Truck },
          { label: "Under Warranty", value: "89%", icon: Shield },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1.5">{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-accent" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Inventory Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card !p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>SKU</th>
              <th>Vendor</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Warranty</th>
              <th>Location</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="cursor-pointer">
                <td>
                  <p className="font-medium text-foreground">{item.name}</p>
                </td>
                <td>
                  <span className={`status-badge ${
                    item.category === "Equipment" ? "status-open" :
                    item.category === "Parts" ? "status-progress" : "status-complete"
                  }`}>{item.category}</span>
                </td>
                <td className="font-mono text-xs text-muted-foreground">{item.sku}</td>
                <td className="text-muted-foreground">{item.vendor}</td>
                <td className="font-medium">{item.qty}</td>
                <td className="text-foreground">{item.price}</td>
                <td className="text-muted-foreground text-xs">{item.warranty}</td>
                <td className="text-muted-foreground text-xs">{item.location}</td>
                <td>
                  {item.qty <= item.minQty ? (
                    <StatusBadge status="urgent" label="Low Stock" />
                  ) : (
                    <StatusBadge status="complete" label="In Stock" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Inventory;
