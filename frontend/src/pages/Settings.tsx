import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings as SettingsIcon,
  MapPin,
  Brain,
  DollarSign,
  Clock,
  Users,
  Shield,
  Warehouse,
  Save,
  Bell,
  Link2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  BellRing,
  BellOff,
  Smartphone,
} from "lucide-react";
import { settingsApi, rolesApi, quickbooksApi, SystemSettings, Role } from "@/lib/api";
import { toast } from "sonner";
import { usePushNotifications, usePWAInstall, useOnlineStatus } from "@/hooks/usePWA";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const queryClient = useQueryClient();
  
  // PWA hooks for device-specific settings
  const pushNotifications = usePushNotifications();
  const pwaInstall = usePWAInstall();
  const isOnline = useOnlineStatus();

  // Queries
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: () => settingsApi.get(),
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.getAll(),
  });

  const { data: quickbooksStatus, isLoading: qbLoading } = useQuery({
    queryKey: ["quickbooksStatus"],
    queryFn: () => quickbooksApi.getStatus(),
  });

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<SystemSettings>) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
      toast.success("Settings updated successfully");
    },
    onError: () => {
      toast.error("Failed to update settings");
    },
  });

  const syncQuickbooksMutation = useMutation({
    mutationFn: (syncType: string) => quickbooksApi.triggerSync({ sync_type: syncType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooksStatus"] });
      toast.success("QuickBooks sync started");
    },
    onError: () => {
      toast.error("Failed to start sync");
    },
  });

  const disconnectQuickbooksMutation = useMutation({
    mutationFn: () => quickbooksApi.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooksStatus"] });
      toast.success("QuickBooks disconnected");
    },
    onError: () => {
      toast.error("Failed to disconnect QuickBooks");
    },
  });

  const handleToggle = (key: keyof SystemSettings, value: boolean) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  const handleSaveRates = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateSettingsMutation.mutate({
      default_tax_rate: parseFloat(formData.get("default_tax_rate") as string) || 0,
      default_labor_rate: parseFloat(formData.get("default_labor_rate") as string) || 95,
      overtime_multiplier: parseFloat(formData.get("overtime_multiplier") as string) || 1.5,
      default_trip_charge: parseFloat(formData.get("default_trip_charge") as string) || 89,
      default_parts_markup: parseFloat(formData.get("default_parts_markup") as string) || 1.35,
    });
  };

  const handleSaveScheduling = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateSettingsMutation.mutate({
      default_job_duration_hours: parseFloat(formData.get("default_job_duration_hours") as string) || 2,
      buffer_time_percent: parseFloat(formData.get("buffer_time_percent") as string) || 15,
    });
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure system-wide settings, roles, and integrations (RFC-002 Section 4.9)
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general" className="data-[state=active]:bg-background">
            <SettingsIcon className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-background">
            <MapPin className="w-4 h-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="pricing" className="data-[state=active]:bg-background">
            <DollarSign className="w-4 h-4 mr-2" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="scheduling" className="data-[state=active]:bg-background">
            <Clock className="w-4 h-4 mr-2" />
            Scheduling
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-background">
            <Shield className="w-4 h-4 mr-2" />
            Roles
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Customer Portal
                </CardTitle>
                <CardDescription>
                  Configure customer self-service options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="customer_portal_enabled">Enable Customer Portal</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow customers to view jobs and pay invoices online
                    </p>
                  </div>
                  <Switch
                    id="customer_portal_enabled"
                    checked={settings?.customer_portal_enabled || false}
                    onCheckedChange={(checked) => handleToggle("customer_portal_enabled", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="allow_customer_scheduling">Allow Self-Scheduling</Label>
                    <p className="text-xs text-muted-foreground">
                      Let customers request appointments online
                    </p>
                  </div>
                  <Switch
                    id="allow_customer_scheduling"
                    checked={settings?.allow_customer_scheduling || false}
                    onCheckedChange={(checked) => handleToggle("allow_customer_scheduling", checked)}
                    disabled={!settings?.customer_portal_enabled}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Warehouse className="w-5 h-5" />
                  Inventory
                </CardTitle>
                <CardDescription>
                  Configure inventory and stock check requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="require_shift_start_stock_check">Shift Start Stock Check</Label>
                    <p className="text-xs text-muted-foreground">
                      Require technicians to verify inventory at shift start
                    </p>
                  </div>
                  <Switch
                    id="require_shift_start_stock_check"
                    checked={settings?.require_shift_start_stock_check || false}
                    onCheckedChange={(checked) => handleToggle("require_shift_start_stock_check", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="require_shift_end_stock_check">Shift End Stock Check</Label>
                    <p className="text-xs text-muted-foreground">
                      Require technicians to verify inventory at shift end
                    </p>
                  </div>
                  <Switch
                    id="require_shift_end_stock_check"
                    checked={settings?.require_shift_end_stock_check || false}
                    onCheckedChange={(checked) => handleToggle("require_shift_end_stock_check", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Google Maps Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Google Maps Integration
                </CardTitle>
                <CardDescription>
                  Enable route calculation and travel time estimation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="google_maps_enabled">Enable Google Maps</Label>
                    <p className="text-xs text-muted-foreground">
                      Calculate routes and estimate travel times
                    </p>
                  </div>
                  <Switch
                    id="google_maps_enabled"
                    checked={settings?.google_maps_enabled || false}
                    onCheckedChange={(checked) => handleToggle("google_maps_enabled", checked)}
                    disabled={!settings?.google_maps_api_key_set}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {settings?.google_maps_api_key_set ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400">
                      API Key Configured
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-400">
                      API Key Not Set
                    </Badge>
                  )}
                </div>
                {!settings?.google_maps_api_key_set && (
                  <p className="text-xs text-muted-foreground">
                    Add <code className="bg-muted px-1 rounded">GOOGLE_MAPS_API_KEY</code> to backend/.env to enable this feature.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* AI Features - Enhanced */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Features
                </CardTitle>
                <CardDescription>
                  AI-powered scheduling, summaries, and insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai_features_enabled">Enable AI Features</Label>
                    <p className="text-xs text-muted-foreground">
                      Smart scheduling, job summaries, and predictions
                    </p>
                  </div>
                  <Switch
                    id="ai_features_enabled"
                    checked={settings?.ai_features_enabled || false}
                    onCheckedChange={(checked) => handleToggle("ai_features_enabled", checked)}
                  />
                </div>
                
                {settings?.ai_features_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="ai_provider">AI Provider</Label>
                      <Select
                        value={settings?.ai_provider || "gemini"}
                        onValueChange={(value) => updateSettingsMutation.mutate({ ai_provider: value as "gemini" | "openai" | "claude" })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Google Gemini</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="claude">Anthropic Claude</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="ai_model">Model</Label>
                      <Input
                        id="ai_model"
                        value={settings?.ai_model || "gemini-2.0-flash"}
                        onChange={(e) => updateSettingsMutation.mutate({ ai_model: e.target.value })}
                        placeholder="e.g., gemini-2.0-flash"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="ai_failover_enabled">Enable Failover</Label>
                        <p className="text-xs text-muted-foreground">
                          Fall back to simple summaries if AI fails
                        </p>
                      </div>
                      <Switch
                        id="ai_failover_enabled"
                        checked={settings?.ai_failover_enabled ?? true}
                        onCheckedChange={(checked) => handleToggle("ai_failover_enabled", checked)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* QuickBooks Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  QuickBooks Integration
                </CardTitle>
                <CardDescription>
                  Sync invoices, payments, and customers with QuickBooks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="quickbooks_enabled">Enable QuickBooks</Label>
                    <p className="text-xs text-muted-foreground">
                      Bi-directional sync with QuickBooks Online
                    </p>
                  </div>
                  <Switch
                    id="quickbooks_enabled"
                    checked={settings?.quickbooks_enabled || false}
                    onCheckedChange={(checked) => handleToggle("quickbooks_enabled", checked)}
                  />
                </div>
                
                {settings?.quickbooks_enabled && (
                  <>
                    <div className="flex items-center gap-2">
                      {qbLoading ? (
                        <Badge className="bg-slate-500/20 text-slate-400">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Checking...
                        </Badge>
                      ) : quickbooksStatus?.connected ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/20 text-yellow-400">
                          <XCircle className="w-3 h-3 mr-1" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                    
                    {!quickbooksStatus?.connected ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          QuickBooks requires OAuth credentials. Set <code className="bg-muted px-1 rounded">QUICKBOOKS_CLIENT_ID</code> and <code className="bg-muted px-1 rounded">QUICKBOOKS_CLIENT_SECRET</code> in backend/.env
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={!quickbooksStatus?.configured}
                          onClick={async () => {
                            try {
                              const { auth_url } = await quickbooksApi.getAuthUrl();
                              window.open(auth_url, "_blank");
                            } catch {
                              toast.error("Failed to get auth URL");
                            }
                          }}
                        >
                          <Link2 className="w-4 h-4 mr-2" />
                          Connect QuickBooks
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Sync Options */}
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Sync Invoices</Label>
                          <Switch
                            checked={settings?.quickbooks_sync_invoices ?? true}
                            onCheckedChange={(checked) => handleToggle("quickbooks_sync_invoices", checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Sync Payments</Label>
                          <Switch
                            checked={settings?.quickbooks_sync_payments ?? true}
                            onCheckedChange={(checked) => handleToggle("quickbooks_sync_payments", checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Sync Customers</Label>
                          <Switch
                            checked={settings?.quickbooks_sync_customers ?? true}
                            onCheckedChange={(checked) => handleToggle("quickbooks_sync_customers", checked)}
                          />
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => syncQuickbooksMutation.mutate("full")}
                            disabled={syncQuickbooksMutation.isPending}
                          >
                            {syncQuickbooksMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Sync Now
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => disconnectQuickbooksMutation.mutate()}
                            disabled={disconnectQuickbooksMutation.isPending}
                          >
                            Disconnect
                          </Button>
                        </div>
                        
                        {quickbooksStatus?.last_sync && (
                          <p className="text-xs text-muted-foreground">
                            Last sync: {new Date(quickbooksStatus.last_sync).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Push Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Push Notifications
                </CardTitle>
                <CardDescription>
                  Configure mobile and desktop push notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="push_notifications_enabled">Enable Push Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Send notifications to mobile devices and browsers
                    </p>
                  </div>
                  <Switch
                    id="push_notifications_enabled"
                    checked={settings?.push_notifications_enabled ?? true}
                    onCheckedChange={(checked) => handleToggle("push_notifications_enabled", checked)}
                  />
                </div>
                
                {settings?.push_notifications_enabled && (
                  <>
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-sm font-medium">Notification Triggers</p>
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">New Chat Messages</Label>
                        <Switch
                          checked={settings?.notify_on_chat_message ?? true}
                          onCheckedChange={(checked) => handleToggle("notify_on_chat_message", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Job Assignments</Label>
                        <Switch
                          checked={settings?.notify_on_job_assignment ?? true}
                          onCheckedChange={(checked) => handleToggle("notify_on_job_assignment", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Schedule Changes</Label>
                        <Switch
                          checked={settings?.notify_on_schedule_change ?? true}
                          onCheckedChange={(checked) => handleToggle("notify_on_schedule_change", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Payment Received</Label>
                        <Switch
                          checked={settings?.notify_on_payment_received ?? true}
                          onCheckedChange={(checked) => handleToggle("notify_on_payment_received", checked)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pricing Settings */}
        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Default Rates & Pricing
              </CardTitle>
              <CardDescription>
                Configure default pricing for jobs and invoices (RFC-002 Section 4.6.1)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveRates} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="default_tax_rate">Default Tax Rate (%)</Label>
                    <Input
                      id="default_tax_rate"
                      name="default_tax_rate"
                      type="number"
                      step="0.01"
                      defaultValue={settings?.default_tax_rate || 0}
                    />
                  </div>
                  <div>
                    <Label htmlFor="default_labor_rate">Default Labor Rate ($/hr)</Label>
                    <Input
                      id="default_labor_rate"
                      name="default_labor_rate"
                      type="number"
                      step="0.01"
                      defaultValue={settings?.default_labor_rate || 95}
                    />
                  </div>
                  <div>
                    <Label htmlFor="overtime_multiplier">Overtime Multiplier</Label>
                    <Input
                      id="overtime_multiplier"
                      name="overtime_multiplier"
                      type="number"
                      step="0.1"
                      defaultValue={settings?.overtime_multiplier || 1.5}
                    />
                  </div>
                  <div>
                    <Label htmlFor="default_trip_charge">Default Trip Charge ($)</Label>
                    <Input
                      id="default_trip_charge"
                      name="default_trip_charge"
                      type="number"
                      step="0.01"
                      defaultValue={settings?.default_trip_charge || 89}
                    />
                  </div>
                  <div>
                    <Label htmlFor="default_parts_markup">Parts Markup Multiplier</Label>
                    <Input
                      id="default_parts_markup"
                      name="default_parts_markup"
                      type="number"
                      step="0.01"
                      defaultValue={settings?.default_parts_markup || 1.35}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      1.35 = 35% markup
                    </p>
                  </div>
                </div>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Pricing"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduling Settings */}
        <TabsContent value="scheduling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Scheduling Defaults
              </CardTitle>
              <CardDescription>
                Configure default scheduling parameters (RFC-002 Section 4.4.4)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveScheduling} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="default_job_duration_hours">Default Job Duration (hours)</Label>
                    <Input
                      id="default_job_duration_hours"
                      name="default_job_duration_hours"
                      type="number"
                      step="0.5"
                      defaultValue={settings?.default_job_duration_hours || 2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="buffer_time_percent">Buffer Time (%)</Label>
                    <Input
                      id="buffer_time_percent"
                      name="buffer_time_percent"
                      type="number"
                      step="1"
                      defaultValue={settings?.buffer_time_percent || 15}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Buffer = (TravelTime × {((settings?.buffer_time_percent || 15) / 100 + 1).toFixed(2)}) + 15 min
                    </p>
                  </div>
                </div>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Scheduling"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles & Permissions */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                System Roles
              </CardTitle>
              <CardDescription>
                View and manage user roles (RFC-002 Section 4.9)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading roles...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.display_name}</TableCell>
                        <TableCell className="text-muted-foreground">{role.description}</TableCell>
                        <TableCell>
                          {role.is_system ? (
                            <Badge className="bg-blue-500/20 text-blue-400">System</Badge>
                          ) : (
                            <Badge className="bg-slate-500/20 text-slate-400">Custom</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
