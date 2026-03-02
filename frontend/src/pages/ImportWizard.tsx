import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileText,
  Users,
  Package,
  Briefcase,
  Wrench,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Target,
} from "lucide-react";
import { importApi, ImportValidation, ImportResult } from "@/lib/api";
import { toast } from "sonner";

const importTypes = [
  { id: "customers", label: "Customers", icon: Users, description: "Import customer records" },
  { id: "leads", label: "Leads", icon: Target, description: "Import lead/prospect data" },
  { id: "jobs", label: "Jobs", icon: Briefcase, description: "Import job/work orders" },
  { id: "inventory", label: "Inventory", icon: Package, description: "Import inventory items" },
  { id: "equipment", label: "Equipment", icon: Wrench, description: "Import customer equipment" },
];

interface ParsedRecord {
  [key: string]: string;
}

export default function ImportWizard() {
  const [step, setStep] = useState(1);
  const [importType, setImportType] = useState<string>("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Parse CSV file
  const parseCSV = useCallback((text: string): ParsedRecord[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Get headers from first line
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    // Parse data rows
    const records: ParsedRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
      const record: ParsedRecord = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });
      records.push(record);
    }
    
    return records;
  }, []);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const records = parseCSV(text);
        setParsedRecords(records);
        setValidation(null);
        setImportResult(null);
      };
      reader.readAsText(file);
    }
  };

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: () => importApi.validate(importType, parsedRecords),
    onSuccess: (data) => {
      setValidation(data);
      if (data.can_import) {
        toast.success(`${data.valid_records} records ready to import`);
      } else {
        toast.warning(`${data.invalid_records} records have errors`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Validation failed");
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: () => importApi.process(importType, parsedRecords, skipDuplicates),
    onSuccess: (data) => {
      setImportResult(data);
      toast.success(`Successfully imported ${data.imported} records`);
      setStep(4);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Import failed");
    },
  });

  // Download template
  const downloadTemplate = async () => {
    try {
      const template = await importApi.getTemplate(importType);
      const csv = [template.columns.join(','), template.sample_row.join(',')].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${importType}_template.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-2">Select Data Type</h2>
        <p className="text-sm text-muted-foreground">Choose what type of data you want to import</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {importTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = importType === type.id;
          return (
            <motion.div
              key={type.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`cursor-pointer transition-all ${isSelected ? 'border-accent ring-2 ring-accent/30' : 'hover:border-accent/50'}`}
                onClick={() => setImportType(type.id)}
                data-testid={`import-type-${type.id}`}
              >
                <CardContent className="p-4 text-center">
                  <div className={`p-3 rounded-lg inline-block mb-2 ${isSelected ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      
      <div className="flex justify-end">
        <Button
          onClick={() => setStep(2)}
          disabled={!importType}
          data-testid="next-step-btn"
        >
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-2">Upload CSV File</h2>
        <p className="text-sm text-muted-foreground">Upload a CSV file with your {importType} data</p>
      </div>
      
      <div className="flex justify-center mb-4">
        <Button variant="outline" onClick={downloadTemplate} data-testid="download-template-btn">
          <Download className="w-4 h-4 mr-2" />
          Download Template
        </Button>
      </div>
      
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-upload"
          data-testid="csv-upload-input"
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <div className="p-4 bg-muted rounded-lg inline-block mb-4">
            <Upload className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="font-medium mb-1">Click to upload or drag & drop</div>
          <div className="text-sm text-muted-foreground">CSV files only</div>
        </label>
        
        {csvFile && (
          <div className="mt-4 p-3 bg-muted rounded-lg inline-flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="font-mono text-sm">{csvFile.name}</span>
            <Badge>{parsedRecords.length} rows</Badge>
          </div>
        )}
      </div>
      
      {parsedRecords.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Preview (first 5 rows)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {Object.keys(parsedRecords[0]).map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-medium">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRecords.slice(0, 5).map((record, idx) => (
                    <tr key={idx} className="border-t border-border">
                      {Object.values(record).map((val, vIdx) => (
                        <td key={vIdx} className="px-3 py-2 truncate max-w-[150px]">{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => {
            validateMutation.mutate();
            setStep(3);
          }}
          disabled={parsedRecords.length === 0}
          data-testid="validate-btn"
        >
          Validate & Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-2">Validation Results</h2>
        <p className="text-sm text-muted-foreground">Review validation before importing</p>
      </div>
      
      {validateMutation.isPending ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
          <p className="text-muted-foreground mt-2">Validating records...</p>
        </div>
      ) : validation ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{validation.total_records}</div>
                <div className="text-xs text-muted-foreground">Total Records</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">{validation.valid_records}</div>
                <div className="text-xs text-muted-foreground">Valid</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{validation.invalid_records}</div>
                <div className="text-xs text-muted-foreground">Invalid</div>
              </CardContent>
            </Card>
          </div>
          
          {validation.errors.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Errors ({validation.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[200px] overflow-y-auto">
                  {validation.errors.slice(0, 10).map((err, idx) => (
                    <div key={idx} className="px-4 py-2 border-t border-border text-sm">
                      <span className="font-mono text-xs bg-red-500/20 px-1 rounded">Row {err.row}</span>
                      <span className="text-muted-foreground ml-2">{err.errors.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {validation.warnings.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-yellow-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings ({validation.warnings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[150px] overflow-y-auto">
                  {validation.warnings.slice(0, 10).map((warn, idx) => (
                    <div key={idx} className="px-4 py-2 border-t border-border text-sm">
                      <span className="font-mono text-xs bg-yellow-500/20 px-1 rounded">Row {warn.row}</span>
                      <span className="text-muted-foreground ml-2">{warn.warnings.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="skip-duplicates">Skip Duplicates</Label>
                  <p className="text-xs text-muted-foreground">Skip records that already exist in the system</p>
                </div>
                <Switch
                  id="skip-duplicates"
                  checked={skipDuplicates}
                  onCheckedChange={setSkipDuplicates}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(2)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => importMutation.mutate()}
          disabled={!validation?.can_import || importMutation.isPending}
          data-testid="import-btn"
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              Import {validation?.valid_records} Records
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="inline-block"
      >
        <div className="p-4 bg-emerald-500/20 rounded-full inline-block">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
        </div>
      </motion.div>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">Import Complete!</h2>
        <p className="text-muted-foreground">Your data has been successfully imported</p>
      </div>
      
      {importResult && (
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{importResult.imported}</div>
              <div className="text-xs text-muted-foreground">Imported</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{importResult.skipped}</div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{importResult.errors}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Button
        onClick={() => {
          setStep(1);
          setImportType("");
          setCsvFile(null);
          setParsedRecords([]);
          setValidation(null);
          setImportResult(null);
        }}
        data-testid="new-import-btn"
      >
        Start New Import
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Import Wizard</h1>
        <p className="text-sm text-muted-foreground">
          Import data from CSV files (RFC-002 Section 4.10)
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s === step
                  ? "bg-accent text-accent-foreground"
                  : s < step
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            {s < 4 && (
              <div className={`w-12 h-0.5 ${s < step ? "bg-emerald-500/50" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </CardContent>
      </Card>
    </div>
  );
}
