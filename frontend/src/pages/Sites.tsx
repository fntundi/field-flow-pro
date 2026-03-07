import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Plus,
  Search,
  Building2,
  Home,
  Factory,
  Users,
  Briefcase,
  Key,
  Car,
  Clock,
  Phone,
  Mail,
  AlertTriangle,
  PawPrint,
  Loader2,
  RefreshCw,
  Edit,
  Trash2,
  History,
  Wrench,
} from "lucide-react";
import { sitesApi, customersApi, Site, SiteCreate, SiteContact, Job, CustomerEquipmentRecord } from "@/lib/api";
import { toast } from "sonner";
import { ContactCustomerMenu } from "@/components/ContactCustomerMenu";

const siteTypeIcons = {
  residential: Home,
  commercial: Building2,
  industrial: Factory,
  "multi-family": Users,
};

const siteTypeLabels = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  "multi-family": "Multi-Family",
};

export default function Sites() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [detailTab, setDetailTab] = useState("info");

  // Form state for new site
  const [newSite, setNewSite] = useState<SiteCreate>({
    customer_id: "",
    name: "",
    site_type: "residential",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    access_instructions: "",
    gate_code: "",
    parking_notes: "",
    has_pets: false,
    pet_notes: "",
    notes: "",
  });

  // Queries
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["sites", search, typeFilter],
    queryFn: () => sitesApi.getAll({
      search: search || undefined,
      site_type: typeFilter !== "all" ? typeFilter : undefined,
    }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customersApi.getAll(),
  });

  const { data: siteJobs = [] } = useQuery({
    queryKey: ["siteJobs", selectedSite?.id],
    queryFn: () => selectedSite ? sitesApi.getJobs(selectedSite.id) : Promise.resolve([]),
    enabled: !!selectedSite,
  });

  const { data: siteEquipment = [] } = useQuery({
    queryKey: ["siteEquipment", selectedSite?.id],
    queryFn: () => selectedSite ? sitesApi.getEquipment(selectedSite.id) : Promise.resolve([]),
    enabled: !!selectedSite,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: SiteCreate) => sitesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setCreateOpen(false);
      resetForm();
      toast.success("Site created successfully");
    },
    onError: () => toast.error("Failed to create site"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Site> }) => sitesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Site updated successfully");
    },
    onError: () => toast.error("Failed to update site"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sitesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setSelectedSite(null);
      toast.success("Site deactivated");
    },
    onError: () => toast.error("Failed to deactivate site"),
  });

  const migrateMutation = useMutation({
    mutationFn: () => sitesApi.migrateFromJobs(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success(`Migration complete: ${result.sites_created} sites created`);
    },
    onError: () => toast.error("Migration failed"),
  });

  const resetForm = () => {
    setNewSite({
      customer_id: "",
      name: "",
      site_type: "residential",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      access_instructions: "",
      gate_code: "",
      parking_notes: "",
      has_pets: false,
      pet_notes: "",
      notes: "",
    });
  };

  const handleCreate = () => {
    if (!newSite.customer_id || !newSite.name || !newSite.address) {
      toast.error("Please fill in required fields");
      return;
    }
    createMutation.mutate(newSite);
  };

  const SiteIcon = ({ type }: { type: Site["site_type"] }) => {
    const Icon = siteTypeIcons[type] || Building2;
    return <Icon className="w-4 h-4" />;
  };

  // Stats
  const stats = {
    total: sites.length,
    residential: sites.filter(s => s.site_type === "residential").length,
    commercial: sites.filter(s => s.site_type === "commercial").length,
    withPets: sites.filter(s => s.has_pets).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sites</h1>
          <p className="text-sm text-muted-foreground">
            Service locations with access info and job history
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => migrateMutation.mutate()}
            disabled={migrateMutation.isPending}
            data-testid="migrate-sites-button"
          >
            {migrateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Import from Jobs
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-site-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Site</DialogTitle>
                <DialogDescription>
                  Create a new service location
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <Select
                      value={newSite.customer_id}
                      onValueChange={(v) => setNewSite({ ...newSite, customer_id: v })}
                    >
                      <SelectTrigger data-testid="customer-select">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Site Type</Label>
                    <Select
                      value={newSite.site_type}
                      onValueChange={(v: Site["site_type"]) => setNewSite({ ...newSite, site_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residential">Residential</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="multi-family">Multi-Family</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Site Name *</Label>
                  <Input
                    value={newSite.name}
                    onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                    placeholder="e.g., Main Office, Smith Residence"
                    data-testid="site-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Address *</Label>
                  <Input
                    value={newSite.address}
                    onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                    placeholder="Street address"
                    data-testid="site-address-input"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={newSite.city}
                      onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={newSite.state}
                      onChange={(e) => setNewSite({ ...newSite, state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ZIP</Label>
                    <Input
                      value={newSite.zip_code}
                      onChange={(e) => setNewSite({ ...newSite, zip_code: e.target.value })}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Access Information</h4>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Access Instructions</Label>
                      <Textarea
                        value={newSite.access_instructions}
                        onChange={(e) => setNewSite({ ...newSite, access_instructions: e.target.value })}
                        placeholder="e.g., Use side entrance, call on arrival"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Gate Code</Label>
                        <Input
                          value={newSite.gate_code}
                          onChange={(e) => setNewSite({ ...newSite, gate_code: e.target.value })}
                          placeholder="#1234"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Parking Notes</Label>
                        <Input
                          value={newSite.parking_notes}
                          onChange={(e) => setNewSite({ ...newSite, parking_notes: e.target.value })}
                          placeholder="Park in visitor spots"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PawPrint className="w-4 h-4" />
                      <Label>Has Pets</Label>
                    </div>
                    <Switch
                      checked={newSite.has_pets}
                      onCheckedChange={(checked) => setNewSite({ ...newSite, has_pets: checked })}
                    />
                  </div>
                  {newSite.has_pets && (
                    <Input
                      value={newSite.pet_notes}
                      onChange={(e) => setNewSite({ ...newSite, pet_notes: e.target.value })}
                      placeholder="Pet details (e.g., 2 dogs, friendly)"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newSite.notes}
                    onChange={(e) => setNewSite({ ...newSite, notes: e.target.value })}
                    placeholder="Additional notes about this site"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Site
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.residential}</p>
                <p className="text-xs text-muted-foreground">Residential</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.commercial}</p>
                <p className="text-xs text-muted-foreground">Commercial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.withPets}</p>
                <p className="text-xs text-muted-foreground">With Pets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="site-search-input"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="industrial">Industrial</SelectItem>
            <SelectItem value="multi-family">Multi-Family</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sites List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : sites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sites found</h3>
            <p className="text-muted-foreground mb-4">
              {search ? "Try a different search term" : "Create your first site or import from existing jobs"}
            </p>
            {!search && (
              <Button onClick={() => migrateMutation.mutate()} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Import Sites from Jobs
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setSelectedSite(site);
                  setDetailTab("info");
                }}
                data-testid={`site-card-${site.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <SiteIcon type={site.site_type} />
                      <CardTitle className="text-base">{site.name}</CardTitle>
                    </div>
                    <Badge variant="outline">{siteTypeLabels[site.site_type]}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {site.customer_name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {site.address}
                    {site.city && `, ${site.city}`}
                    {site.state && `, ${site.state}`}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {site.total_jobs} jobs
                    </span>
                    {site.gate_code && (
                      <span className="flex items-center gap-1">
                        <Key className="w-3 h-3" />
                        Gate code
                      </span>
                    )}
                    {site.has_pets && (
                      <span className="flex items-center gap-1 text-orange-500">
                        <PawPrint className="w-3 h-3" />
                        Pets
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Site Detail Sheet */}
      <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedSite && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SiteIcon type={selectedSite.site_type} />
                  <SheetTitle>{selectedSite.name}</SheetTitle>
                </div>
                <SheetDescription>
                  {selectedSite.customer_name} • {siteTypeLabels[selectedSite.site_type]}
                </SheetDescription>
              </SheetHeader>

              <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="jobs">Jobs ({siteJobs.length})</TabsTrigger>
                  <TabsTrigger value="equipment">Equipment ({siteEquipment.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  {/* Address */}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium">
                      {selectedSite.address}
                      {selectedSite.city && <><br />{selectedSite.city}, {selectedSite.state} {selectedSite.zip_code}</>}
                    </p>
                  </div>

                  {/* Access Info */}
                  {(selectedSite.gate_code || selectedSite.access_instructions || selectedSite.parking_notes) && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Key className="w-4 h-4" />
                          Access Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {selectedSite.gate_code && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Gate: {selectedSite.gate_code}</Badge>
                          </div>
                        )}
                        {selectedSite.access_instructions && (
                          <p>{selectedSite.access_instructions}</p>
                        )}
                        {selectedSite.parking_notes && (
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Car className="w-3 h-3" />
                            {selectedSite.parking_notes}
                          </p>
                        )}
                        {selectedSite.building_hours && (
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {selectedSite.building_hours}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Pets Warning */}
                  {selectedSite.has_pets && (
                    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-2">
                          <PawPrint className="w-5 h-5 text-orange-500 mt-0.5" />
                          <div>
                            <p className="font-medium text-orange-700 dark:text-orange-400">Pets on Site</p>
                            {selectedSite.pet_notes && (
                              <p className="text-sm text-orange-600 dark:text-orange-300">{selectedSite.pet_notes}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Contacts */}
                  {selectedSite.contacts && selectedSite.contacts.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Contacts</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedSite.contacts.map((contact, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
                            </div>
                            <div className="flex gap-2">
                              {contact.phone && (
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={`tel:${contact.phone}`}><Phone className="w-3 h-3" /></a>
                                </Button>
                              )}
                              {contact.email && (
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={`mailto:${contact.email}`}><Mail className="w-3 h-3" /></a>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Notes */}
                  {selectedSite.notes && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Notes</Label>
                      <p className="text-sm">{selectedSite.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" className="flex-1">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Deactivate this site?")) {
                          deleteMutation.mutate(selectedSite.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="jobs" className="mt-4">
                  {siteJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No job history</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {siteJobs.map((job: Job) => (
                        <Card key={job.id} className="cursor-pointer hover:bg-muted/50">
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{job.job_number}</p>
                                <p className="text-xs text-muted-foreground">{job.job_type}</p>
                              </div>
                              <Badge variant={job.status === "completed" ? "default" : "outline"}>
                                {job.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="equipment" className="mt-4">
                  {siteEquipment.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No equipment registered</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {siteEquipment.map((equip: CustomerEquipmentRecord) => (
                        <Card key={equip.id}>
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{equip.equipment_type}</p>
                                <p className="text-xs text-muted-foreground">
                                  {equip.manufacturer} {equip.model}
                                </p>
                              </div>
                              {equip.is_in_warranty && (
                                <Badge variant="secondary" className="text-green-600">In Warranty</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
