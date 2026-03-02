import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Briefcase,
  Calendar,
  Download,
  Play,
  Filter,
  Plus,
  X,
  Loader2,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { reportsApi } from "@/lib/api";
import { toast } from "sonner";

interface ReportFilter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface ReportColumn {
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency';
}

const dataSourceOptions = [
  { value: "jobs", label: "Jobs", icon: Briefcase },
  { value: "customers", label: "Customers", icon: Users },
  { value: "invoices", label: "Invoices", icon: FileText },
  { value: "technicians", label: "Technicians", icon: Users },
  { value: "inventory", label: "Inventory", icon: BarChart3 },
  { value: "leads", label: "Leads", icon: TrendingUp },
];

const fieldOptions: Record<string, ReportColumn[]> = {
  jobs: [
    { field: "job_number", label: "Job Number", type: "text" },
    { field: "customer_name", label: "Customer", type: "text" },
    { field: "job_type", label: "Job Type", type: "text" },
    { field: "status", label: "Status", type: "text" },
    { field: "priority", label: "Priority", type: "text" },
    { field: "created_at", label: "Created Date", type: "date" },
    { field: "scheduled_date", label: "Scheduled Date", type: "date" },
    { field: "total_revenue", label: "Revenue", type: "currency" },
  ],
  customers: [
    { field: "name", label: "Name", type: "text" },
    { field: "email", label: "Email", type: "text" },
    { field: "phone", label: "Phone", type: "text" },
    { field: "city", label: "City", type: "text" },
    { field: "state", label: "State", type: "text" },
    { field: "created_at", label: "Created Date", type: "date" },
    { field: "total_jobs", label: "Total Jobs", type: "number" },
    { field: "total_revenue", label: "Total Revenue", type: "currency" },
  ],
  invoices: [
    { field: "invoice_number", label: "Invoice Number", type: "text" },
    { field: "customer_name", label: "Customer", type: "text" },
    { field: "status", label: "Status", type: "text" },
    { field: "total", label: "Total", type: "currency" },
    { field: "balance_due", label: "Balance Due", type: "currency" },
    { field: "created_at", label: "Created Date", type: "date" },
    { field: "due_date", label: "Due Date", type: "date" },
  ],
  technicians: [
    { field: "name", label: "Name", type: "text" },
    { field: "email", label: "Email", type: "text" },
    { field: "role", label: "Role", type: "text" },
    { field: "status", label: "Status", type: "text" },
    { field: "jobs_completed", label: "Jobs Completed", type: "number" },
    { field: "avg_rating", label: "Avg Rating", type: "number" },
  ],
  inventory: [
    { field: "name", label: "Name", type: "text" },
    { field: "sku", label: "SKU", type: "text" },
    { field: "category", label: "Category", type: "text" },
    { field: "quantity_on_hand", label: "Qty On Hand", type: "number" },
    { field: "unit_cost", label: "Unit Cost", type: "currency" },
    { field: "unit_price", label: "Unit Price", type: "currency" },
    { field: "total_value", label: "Total Value", type: "currency" },
  ],
  leads: [
    { field: "lead_number", label: "Lead Number", type: "text" },
    { field: "contact_name", label: "Contact", type: "text" },
    { field: "source", label: "Source", type: "text" },
    { field: "status", label: "Status", type: "text" },
    { field: "estimated_value", label: "Estimated Value", type: "currency" },
    { field: "created_at", label: "Created Date", type: "date" },
  ],
};

const operatorOptions = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "between", label: "Between" },
];

export default function ReportsBuilder() {
  const [dataSource, setDataSource] = useState<string>("jobs");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["job_number", "customer_name", "status"]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groupBy, setGroupBy] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [reportResults, setReportResults] = useState<any[] | null>(null);
  const [aggregations, setAggregations] = useState<any>(null);

  // Fetch summary metrics
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["reportsSummary"],
    queryFn: () => reportsApi.getSummary(),
  });

  // Run report mutation
  const runReportMutation = useMutation({
    mutationFn: () => reportsApi.query({
      data_source: dataSource,
      columns: selectedColumns,
      filters: filters.map(f => ({
        field: f.field,
        operator: f.operator,
        value: f.value,
      })),
      group_by: groupBy || undefined,
      sort_by: sortBy || undefined,
      sort_order: sortOrder,
      date_range: dateRange.start && dateRange.end ? dateRange : undefined,
    }),
    onSuccess: (data) => {
      setReportResults(data.results || []);
      setAggregations(data.aggregations || null);
      toast.success(`Report generated: ${data.results?.length || 0} records`);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to generate report");
    },
  });

  const addFilter = () => {
    const availableFields = fieldOptions[dataSource] || [];
    if (availableFields.length === 0) return;
    
    setFilters([...filters, {
      id: Date.now().toString(),
      field: availableFields[0].field,
      operator: "equals",
      value: "",
    }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<ReportFilter>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const toggleColumn = (field: string) => {
    if (selectedColumns.includes(field)) {
      setSelectedColumns(selectedColumns.filter(c => c !== field));
    } else {
      setSelectedColumns([...selectedColumns, field]);
    }
  };

  const exportToCSV = () => {
    if (!reportResults || reportResults.length === 0) return;
    
    const headers = selectedColumns.join(',');
    const rows = reportResults.map(row => 
      selectedColumns.map(col => {
        const value = row[col];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${dataSource}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported to CSV");
  };

  const availableFields = fieldOptions[dataSource] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports Builder</h1>
          <p className="text-sm text-muted-foreground">
            Create custom ad-hoc reports (RFC-002 Section 4.8.2)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={!reportResults || reportResults.length === 0}
            data-testid="export-csv-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() => runReportMutation.mutate()}
            disabled={selectedColumns.length === 0 || runReportMutation.isPending}
            data-testid="run-report-btn"
          >
            {runReportMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Briefcase className="w-4 h-4" />
              Total Jobs
            </div>
            <div className="text-2xl font-bold">
              {summaryLoading ? "-" : summaryData?.total_jobs || 0}
            </div>
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              {summaryData?.jobs_this_month || 0} this month
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Revenue
            </div>
            <div className="text-2xl font-bold">
              ${summaryLoading ? "-" : (summaryData?.total_revenue || 0).toLocaleString()}
            </div>
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              ${(summaryData?.revenue_this_month || 0).toLocaleString()} MTD
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="w-4 h-4" />
              Customers
            </div>
            <div className="text-2xl font-bold">
              {summaryLoading ? "-" : summaryData?.total_customers || 0}
            </div>
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              {summaryData?.new_customers_this_month || 0} new
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Conversion Rate
            </div>
            <div className="text-2xl font-bold">
              {summaryLoading ? "-" : `${summaryData?.lead_conversion_rate || 0}%`}
            </div>
            <div className="text-xs text-muted-foreground">
              Leads to customers
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report Configuration */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Report Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Data Source */}
            <div>
              <Label>Data Source</Label>
              <Select value={dataSource} onValueChange={(v) => {
                setDataSource(v);
                setSelectedColumns(fieldOptions[v]?.slice(0, 3).map(f => f.field) || []);
                setFilters([]);
                setGroupBy("");
                setSortBy("");
              }}>
                <SelectTrigger data-testid="data-source-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dataSourceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="w-4 h-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Columns */}
            <div>
              <Label className="mb-2 block">Columns</Label>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {availableFields.map((field) => (
                  <label
                    key={field.field}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(field.field)}
                      onChange={() => toggleColumn(field.field)}
                      className="rounded"
                    />
                    <span className="text-sm">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <Label>Date Range</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  placeholder="Start"
                />
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  placeholder="End"
                />
              </div>
            </div>

            {/* Group By */}
            <div>
              <Label>Group By</Label>
              <Select value={groupBy || "none"} onValueChange={(v) => setGroupBy(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableFields.map((field) => (
                    <SelectItem key={field.field} value={field.field}>{field.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div>
              <Label>Sort By</Label>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((field) => (
                      <SelectItem key={field.field} value={field.field}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Asc</SelectItem>
                    <SelectItem value="desc">Desc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Filters</Label>
                <Button size="sm" variant="ghost" onClick={addFilter}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {filters.map((filter) => (
                  <div key={filter.id} className="p-2 bg-muted rounded text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <Select value={filter.field} onValueChange={(v) => updateFilter(filter.id, { field: v })}>
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map((f) => (
                            <SelectItem key={f.field} value={f.field}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-6 w-6 ml-1" onClick={() => removeFilter(filter.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Select value={filter.operator} onValueChange={(v) => updateFilter(filter.id, { operator: v })}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operatorOptions.map((op) => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8"
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        placeholder="Value"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Results</CardTitle>
              {reportResults && (
                <Badge>{reportResults.length} records</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!reportResults ? (
              <div className="text-center py-16 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Configure your report and click "Run Report" to see results</p>
              </div>
            ) : reportResults.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No records found matching your criteria</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedColumns.map((col) => {
                        const field = availableFields.find(f => f.field === col);
                        return (
                          <TableHead key={col}>{field?.label || col}</TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportResults.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx}>
                        {selectedColumns.map((col) => {
                          const field = availableFields.find(f => f.field === col);
                          let value = row[col];
                          
                          if (field?.type === 'currency' && typeof value === 'number') {
                            value = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                          } else if (field?.type === 'date' && value) {
                            value = new Date(value).toLocaleDateString();
                          }
                          
                          return (
                            <TableCell key={col}>{value ?? '-'}</TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reportResults.length > 100 && (
                  <div className="text-center py-2 text-sm text-muted-foreground">
                    Showing first 100 of {reportResults.length} results
                  </div>
                )}
              </div>
            )}

            {/* Aggregations */}
            {aggregations && Object.keys(aggregations).length > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(aggregations).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</div>
                      <div className="font-bold">
                        {typeof value === 'number' 
                          ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                          : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
