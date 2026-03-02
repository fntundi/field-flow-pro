import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Package,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  Loader2,
  Search,
} from "lucide-react";
import {
  jobEquipmentApi,
  inventoryApi,
  InventoryItem,
  JobEquipmentUsage,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface EquipmentApprovalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobNumber: string;
  onApproved: () => void;
}

interface EquipmentLineItem {
  item_id: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  serial_number?: string;
}

export const EquipmentApprovalSheet = ({
  open,
  onOpenChange,
  jobId,
  jobNumber,
  onApproved,
}: EquipmentApprovalSheetProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [equipmentUsage, setEquipmentUsage] = useState<JobEquipmentUsage | null>(null);
  const [actualItems, setActualItems] = useState<EquipmentLineItem[]>([]);
  const [notes, setNotes] = useState("");
  
  // Search for adding items
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);

  useEffect(() => {
    if (open && jobId) {
      fetchEquipmentUsage();
      fetchInventoryItems();
    }
  }, [open, jobId]);

  const fetchEquipmentUsage = async () => {
    setLoading(true);
    try {
      const usage = await jobEquipmentApi.get(jobId);
      setEquipmentUsage(usage);
      
      // Initialize actual items from planned items
      if (usage?.planned_items?.length) {
        setActualItems(
          usage.planned_items.map(item => ({
            item_id: item.item_id,
            item_name: item.item_name,
            sku: item.sku,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
          }))
        );
      } else if (usage?.actual_items?.length) {
        setActualItems(usage.actual_items);
      }
    } catch (error) {
      console.error("Error fetching equipment usage:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const items = await inventoryApi.getItems();
      setInventoryItems(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      const filtered = inventoryItems.filter(
        item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 10));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, inventoryItems]);

  const updateItemQuantity = (itemId: string, delta: number) => {
    setActualItems(prev =>
      prev.map(item =>
        item.item_id === itemId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const addItem = (item: InventoryItem) => {
    const existing = actualItems.find(i => i.item_id === item.id);
    if (existing) {
      updateItemQuantity(item.id, 1);
    } else {
      setActualItems(prev => [
        ...prev,
        {
          item_id: item.id,
          item_name: item.name,
          sku: item.sku,
          quantity: 1,
          unit_cost: item.unit_cost,
        },
      ]);
    }
    setSearchQuery("");
    setSearchOpen(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await jobEquipmentApi.approve(jobId, actualItems, notes);
      
      toast({
        title: "Equipment Approved",
        description: result.has_variance
          ? "Inventory updated. Note: Equipment usage differs from estimate."
          : "Inventory has been updated.",
      });
      
      onApproved();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve equipment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalCost = actualItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Equipment Used - {jobNumber}
          </SheetTitle>
          <SheetDescription>
            Review and confirm equipment actually used on this job.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Items List */}
            <div className="max-h-[40vh] overflow-y-auto space-y-2">
              {actualItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No equipment listed. Add items used on this job.</p>
                </div>
              ) : (
                actualItems.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.sku} • ${item.unit_cost.toFixed(2)}/ea
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => updateItemQuantity(item.item_id, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => updateItemQuantity(item.item_id, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Item Search */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search to add equipment..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      className="w-full p-3 text-left hover:bg-muted/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                      <Badge variant="outline">${item.unit_cost.toFixed(2)}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about equipment usage..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Equipment Cost</span>
                <span className="text-lg font-bold">${totalCost.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {actualItems.length} items, {actualItems.reduce((sum, i) => sum + i.quantity, 0)} units
              </p>
            </div>

            {/* Variance Warning */}
            {equipmentUsage?.planned_items && actualItems.length > 0 && (
              <div className="text-xs text-amber-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Changes will be tracked and compared to the original estimate.
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Approve & Update Inventory
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default EquipmentApprovalSheet;
