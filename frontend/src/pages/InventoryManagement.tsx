import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Warehouse,
  Truck,
  ArrowRightLeft,
  MapPin,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  Edit,
  Building2,
} from "lucide-react";
import {
  inventoryApi,
  InventoryItem,
  InventoryLocation,
  LocationInventory,
  InventoryTransfer,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function InventoryManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("locations");
  const [search, setSearch] = useState("");
  
  // Data states
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | null>(null);
  const [locationStock, setLocationStock] = useState<LocationInventory[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  
  // Loading states
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  
  // Dialog states
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<InventoryLocation | null>(null);
  const [editingStock, setEditingStock] = useState<LocationInventory | null>(null);
  
  // Form states
  const [locationForm, setLocationForm] = useState({
    name: "",
    location_type: "warehouse" as const,
    address: "",
    city: "",
    state: "",
    zip_code: "",
    manager_name: "",
    phone: "",
    is_primary: false,
  });
  
  const [transferForm, setTransferForm] = useState({
    from_location_id: "",
    to_location_id: "",
    items: [] as Array<{ item_id: string; quantity: number }>,
    notes: "",
  });
  
  const [stockForm, setStockForm] = useState({
    quantity_on_hand: 0,
    min_quantity: 0,
    max_quantity: 100,
    reorder_point: 0,
  });

  // Fetch data
  const fetchLocations = useCallback(async () => {
    try {
      setLoadingLocations(true);
      const data = await inventoryApi.getLocations();
      setLocations(data);
    } catch (error) {
      console.error("Failed to fetch locations:", error);
      toast.error("Failed to load locations");
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  const fetchLocationStock = useCallback(async (locationId: string) => {
    try {
      setLoadingStock(true);
      const data = await inventoryApi.getLocationStock(locationId);
      setLocationStock(data);
    } catch (error) {
      console.error("Failed to fetch stock:", error);
      toast.error("Failed to load stock");
    } finally {
      setLoadingStock(false);
    }
  }, []);

  const fetchTransfers = useCallback(async () => {
    try {
      setLoadingTransfers(true);
      const data = await inventoryApi.getTransfers();
      setTransfers(data);
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
      toast.error("Failed to load transfers");
    } finally {
      setLoadingTransfers(false);
    }
  }, []);

  const fetchAllItems = useCallback(async () => {
    try {
      const data = await inventoryApi.getItems();
      setAllItems(data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchTransfers();
    fetchAllItems();
  }, [fetchLocations, fetchTransfers, fetchAllItems]);

  useEffect(() => {
    if (selectedLocation) {
      fetchLocationStock(selectedLocation.id);
    }
  }, [selectedLocation, fetchLocationStock]);

  // Handlers
  const handleCreateLocation = async () => {
    try {
      if (editingLocation) {
        await inventoryApi.updateLocation(editingLocation.id, locationForm);
        toast.success("Location updated");
      } else {
        await inventoryApi.createLocation(locationForm);
        toast.success("Location created");
      }
      setShowLocationDialog(false);
      resetLocationForm();
      fetchLocations();
    } catch (error) {
      console.error("Failed to save location:", error);
      toast.error("Failed to save location");
    }
  };

  const handleCreateTransfer = async () => {
    try {
      const fromLocation = locations.find(l => l.id === transferForm.from_location_id);
      const toLocation = locations.find(l => l.id === transferForm.to_location_id);
      
      const transferData = {
        from_location_id: transferForm.from_location_id,
        from_location_name: fromLocation?.name || "",
        to_location_id: transferForm.to_location_id,
        to_location_name: toLocation?.name || "",
        items: transferForm.items.map(item => {
          const invItem = allItems.find(i => i.id === item.item_id);
          return {
            item_id: item.item_id,
            item_name: invItem?.name || "",
            quantity: item.quantity,
            unit_cost: invItem?.unit_cost || 0,
          };
        }),
        notes: transferForm.notes,
      };
      
      await inventoryApi.createTransfer(transferData);
      toast.success("Transfer request created");
      setShowTransferDialog(false);
      resetTransferForm();
      fetchTransfers();
    } catch (error) {
      console.error("Failed to create transfer:", error);
      toast.error("Failed to create transfer");
    }
  };

  const handleApproveTransfer = async (transferId: string) => {
    try {
      await inventoryApi.approveTransfer(transferId);
      toast.success("Transfer approved");
      fetchTransfers();
    } catch (error) {
      console.error("Failed to approve transfer:", error);
      toast.error("Failed to approve transfer");
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    try {
      await inventoryApi.receiveTransfer(transferId);
      toast.success("Transfer received");
      fetchTransfers();
      if (selectedLocation) {
        fetchLocationStock(selectedLocation.id);
      }
    } catch (error) {
      console.error("Failed to receive transfer:", error);
      toast.error("Failed to receive transfer");
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedLocation || !editingStock) return;
    
    try {
      await inventoryApi.updateLocationStock(
        selectedLocation.id,
        editingStock.item_id,
        stockForm
      );
      toast.success("Stock updated");
      setShowStockDialog(false);
      setEditingStock(null);
      fetchLocationStock(selectedLocation.id);
    } catch (error) {
      console.error("Failed to update stock:", error);
      toast.error("Failed to update stock");
    }
  };

  const resetLocationForm = () => {
    setEditingLocation(null);
    setLocationForm({
      name: "",
      location_type: "warehouse",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      manager_name: "",
      phone: "",
      is_primary: false,
    });
  };

  const resetTransferForm = () => {
    setTransferForm({
      from_location_id: "",
      to_location_id: "",
      items: [],
      notes: "",
    });
  };

  const openEditLocation = (location: InventoryLocation) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      location_type: location.location_type as any,
      address: location.address || "",
      city: location.city || "",
      state: location.state || "",
      zip_code: location.zip_code || "",
      manager_name: location.manager_name || "",
      phone: location.phone || "",
      is_primary: location.is_primary,
    });
    setShowLocationDialog(true);
  };

  const openEditStock = (stock: LocationInventory) => {
    setEditingStock(stock);
    setStockForm({
      quantity_on_hand: stock.quantity_on_hand,
      min_quantity: stock.min_quantity,
      max_quantity: stock.max_quantity,
      reorder_point: stock.reorder_point,
    });
    setShowStockDialog(true);
  };

  // Stats
  const totalLocations = locations.length;
  const warehouseCount = locations.filter(l => l.location_type === "warehouse").length;
  const truckCount = locations.filter(l => l.location_type === "truck").length;
  const pendingTransfers = transfers.filter(t => t.status === "pending").length;
  const lowStockItems = locationStock.filter(s => s.quantity_on_hand <= s.reorder_point).length;

  // Filtered data
  const filteredLocations = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.city?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTransfers = transfers.filter(t =>
    t.transfer_number.toLowerCase().includes(search.toLowerCase()) ||
    t.from_location_name.toLowerCase().includes(search.toLowerCase()) ||
    t.to_location_name.toLowerCase().includes(search.toLowerCase())
  );

  const getLocationIcon = (type: string) => {
    switch (type) {
      case "warehouse": return Warehouse;
      case "truck": return Truck;
      case "satellite": return Building2;
      default: return MapPin;
    }
  };

  const getTransferStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "in_transit":
        return <Badge className="bg-blue-500/20 text-blue-400"><ArrowRightLeft className="w-3 h-3 mr-1" />In Transit</Badge>;
      case "received":
        return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle className="w-3 h-3 mr-1" />Received</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Multi-Warehouse Inventory</h1>
          <p className="page-subtitle">Manage stock across warehouses, trucks, and locations</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              fetchLocations();
              fetchTransfers();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowTransferDialog(true)} data-testid="create-transfer-btn">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            New Transfer
          </Button>
          <Button onClick={() => setShowLocationDialog(true)} data-testid="create-location-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "Total Locations", value: totalLocations, icon: MapPin, color: "text-accent" },
          { label: "Warehouses", value: warehouseCount, icon: Warehouse, color: "text-blue-400" },
          { label: "Trucks", value: truckCount, icon: Truck, color: "text-emerald-400" },
          { label: "Pending Transfers", value: pendingTransfers, icon: Clock, color: "text-amber-400" },
          { label: "Low Stock Items", value: lowStockItems, icon: AlertTriangle, color: "text-red-400" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="metric-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="locations" data-testid="tab-locations">
              <MapPin className="w-4 h-4 mr-2" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="stock" data-testid="tab-stock">
              <Package className="w-4 h-4 mr-2" />
              Stock View
            </TabsTrigger>
            <TabsTrigger value="transfers" data-testid="tab-transfers">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfers
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Locations Tab */}
        <TabsContent value="locations" className="mt-6">
          {loadingLocations ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : filteredLocations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="metric-card text-center py-12"
            >
              <Warehouse className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Locations Found</h3>
              <p className="text-muted-foreground mb-4">Add your first warehouse or truck location</p>
              <Button onClick={() => setShowLocationDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredLocations.map((location, i) => {
                  const Icon = getLocationIcon(location.location_type);
                  return (
                    <motion.div
                      key={location.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "metric-card cursor-pointer hover:border-accent/50 transition-colors",
                        selectedLocation?.id === location.id && "border-accent"
                      )}
                      onClick={() => {
                        setSelectedLocation(location);
                        setActiveTab("stock");
                      }}
                      data-testid={`location-${location.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">{location.name}</h3>
                            <p className="text-xs text-muted-foreground capitalize">
                              {location.location_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {location.is_primary && (
                            <Badge className="bg-accent/20 text-accent text-xs">Primary</Badge>
                          )}
                          {!location.is_active && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {location.address && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {location.address}
                          {location.city && `, ${location.city}`}
                          {location.state && `, ${location.state}`}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                        {location.manager_name && (
                          <span className="text-xs text-muted-foreground">
                            Manager: {location.manager_name}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditLocation(location);
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Stock View Tab */}
        <TabsContent value="stock" className="mt-6">
          <div className="space-y-4">
            {/* Location Selector */}
            <div className="flex items-center gap-4">
              <Label>Select Location:</Label>
              <Select
                value={selectedLocation?.id || ""}
                onValueChange={(id) => {
                  const loc = locations.find(l => l.id === id);
                  setSelectedLocation(loc || null);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.location_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedLocation ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="metric-card text-center py-12"
              >
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Location</h3>
                <p className="text-muted-foreground">Choose a location to view its inventory stock</p>
              </motion.div>
            ) : loadingStock ? (
              <div className="flex items-center justify-center h-48">
                <RefreshCw className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : locationStock.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="metric-card text-center py-12"
              >
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Stock Records</h3>
                <p className="text-muted-foreground">No inventory items at this location yet</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="metric-card !p-0 overflow-hidden"
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>SKU</th>
                      <th>On Hand</th>
                      <th>Reserved</th>
                      <th>Available</th>
                      <th>Min/Max</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationStock.map((stock) => (
                      <tr key={stock.id}>
                        <td className="font-medium">{stock.item_name || "Unknown Item"}</td>
                        <td className="font-mono text-xs text-muted-foreground">
                          {stock.item_sku || "—"}
                        </td>
                        <td className="font-medium">{stock.quantity_on_hand}</td>
                        <td className="text-muted-foreground">{stock.quantity_reserved}</td>
                        <td className="text-foreground">{stock.quantity_available}</td>
                        <td className="text-xs text-muted-foreground">
                          {stock.min_quantity} / {stock.max_quantity}
                        </td>
                        <td className="text-foreground">
                          ${stock.total_value.toFixed(2)}
                        </td>
                        <td>
                          {stock.quantity_on_hand <= stock.reorder_point ? (
                            <Badge className="bg-red-500/20 text-red-400">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Low
                            </Badge>
                          ) : stock.quantity_on_hand <= stock.min_quantity * 1.5 ? (
                            <Badge className="bg-amber-500/20 text-amber-400">
                              Warning
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-400">
                              OK
                            </Badge>
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditStock(stock)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </div>
        </TabsContent>

        {/* Transfers Tab */}
        <TabsContent value="transfers" className="mt-6">
          {loadingTransfers ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : filteredTransfers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="metric-card text-center py-12"
            >
              <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Transfers</h3>
              <p className="text-muted-foreground mb-4">Create a transfer to move inventory between locations</p>
              <Button onClick={() => setShowTransferDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Transfer
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="metric-card !p-0 overflow-hidden"
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Transfer #</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Items</th>
                    <th>Requested</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.map((transfer) => (
                    <tr key={transfer.id}>
                      <td className="font-mono text-sm">{transfer.transfer_number}</td>
                      <td>{transfer.from_location_name}</td>
                      <td>{transfer.to_location_name}</td>
                      <td className="text-muted-foreground">
                        {transfer.items.length} item(s)
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {new Date(transfer.requested_at).toLocaleDateString()}
                      </td>
                      <td>{getTransferStatusBadge(transfer.status)}</td>
                      <td>
                        <div className="flex gap-1">
                          {transfer.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveTransfer(transfer.id)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                          )}
                          {transfer.status === "in_transit" && (
                            <Button
                              size="sm"
                              onClick={() => handleReceiveTransfer(transfer.id)}
                            >
                              <Package className="w-3 h-3 mr-1" />
                              Receive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit Location" : "Add New Location"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation
                ? "Update the location details"
                : "Create a new warehouse, truck, or satellite location"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={locationForm.name}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, name: e.target.value })
                  }
                  placeholder="Main Warehouse"
                />
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={locationForm.location_type}
                  onValueChange={(v) =>
                    setLocationForm({ ...locationForm, location_type: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="satellite">Satellite</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={locationForm.address}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, address: e.target.value })
                }
                placeholder="123 Main St"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={locationForm.city}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={locationForm.state}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, state: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP</Label>
                <Input
                  value={locationForm.zip_code}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, zip_code: e.target.value })
                  }
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Manager Name</Label>
                <Input
                  value={locationForm.manager_name}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, manager_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={locationForm.phone}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, phone: e.target.value })
                  }
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={locationForm.is_primary}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, is_primary: e.target.checked })
                }
                className="rounded border-border"
              />
              <Label htmlFor="is_primary">Set as primary location</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLocationDialog(false);
              resetLocationForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateLocation} disabled={!locationForm.name}>
              {editingLocation ? "Update" : "Create"} Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Inventory Transfer</DialogTitle>
            <DialogDescription>
              Move inventory between locations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Location *</Label>
                <Select
                  value={transferForm.from_location_id}
                  onValueChange={(v) =>
                    setTransferForm({ ...transferForm, from_location_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Location *</Label>
                <Select
                  value={transferForm.to_location_id}
                  onValueChange={(v) =>
                    setTransferForm({ ...transferForm, to_location_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((loc) => loc.id !== transferForm.from_location_id)
                      .map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Items to Transfer</Label>
              <div className="border border-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {allItems.slice(0, 10).map((item) => {
                  const existing = transferForm.items.find(i => i.item_id === item.id);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm flex-1">{item.name}</span>
                      <Input
                        type="number"
                        min="0"
                        className="w-20 h-8"
                        placeholder="Qty"
                        value={existing?.quantity || ""}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 0;
                          if (qty > 0) {
                            setTransferForm({
                              ...transferForm,
                              items: [
                                ...transferForm.items.filter(i => i.item_id !== item.id),
                                { item_id: item.id, quantity: qty },
                              ],
                            });
                          } else {
                            setTransferForm({
                              ...transferForm,
                              items: transferForm.items.filter(i => i.item_id !== item.id),
                            });
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={transferForm.notes}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, notes: e.target.value })
                }
                placeholder="Optional transfer notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowTransferDialog(false);
              resetTransferForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTransfer}
              disabled={
                !transferForm.from_location_id ||
                !transferForm.to_location_id ||
                transferForm.items.length === 0
              }
            >
              Create Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Dialog */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Stock Levels</DialogTitle>
            <DialogDescription>
              {editingStock?.item_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity On Hand</Label>
              <Input
                type="number"
                value={stockForm.quantity_on_hand}
                onChange={(e) =>
                  setStockForm({ ...stockForm, quantity_on_hand: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Quantity</Label>
                <Input
                  type="number"
                  value={stockForm.min_quantity}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, min_quantity: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Quantity</Label>
                <Input
                  type="number"
                  value={stockForm.max_quantity}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, max_quantity: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reorder Point</Label>
              <Input
                type="number"
                value={stockForm.reorder_point}
                onChange={(e) =>
                  setStockForm({ ...stockForm, reorder_point: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStock}>
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
