import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  MessageSquare,
  Send,
  Clock,
  User,
  Briefcase,
  BarChart3,
  Settings,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { voipApi, VoIPCallLog, VoIPSMS, VoIPPhoneNumber } from "@/lib/api";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  initiated: "bg-blue-500",
  ringing: "bg-yellow-500",
  answered: "bg-green-500",
  completed: "bg-green-600",
  missed: "bg-red-500",
  failed: "bg-red-600",
  voicemail: "bg-purple-500",
};

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  missed: <PhoneMissed className="w-4 h-4 text-red-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
};

export default function Communications() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("calls");
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  
  // Call form state
  const [callTo, setCallTo] = useState("");
  const [callFrom, setCallFrom] = useState("");
  const [callNotes, setCallNotes] = useState("");
  
  // SMS form state
  const [smsTo, setSmsTo] = useState("");
  const [smsFrom, setSmsFrom] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  
  // Queries
  const { data: status } = useQuery({
    queryKey: ["voip-status"],
    queryFn: () => voipApi.getStatus(),
  });
  
  const { data: phoneNumbers } = useQuery({
    queryKey: ["voip-numbers"],
    queryFn: () => voipApi.getPhoneNumbers(),
  });
  
  const { data: callsData, isLoading: callsLoading } = useQuery({
    queryKey: ["voip-calls"],
    queryFn: () => voipApi.getCalls({ limit: 50 }),
  });
  
  const { data: smsData, isLoading: smsLoading } = useQuery({
    queryKey: ["voip-sms"],
    queryFn: () => voipApi.getSMS({ limit: 50 }),
  });
  
  const { data: analytics } = useQuery({
    queryKey: ["voip-analytics"],
    queryFn: () => voipApi.getAnalytics(30),
  });
  
  // Mutations
  const callMutation = useMutation({
    mutationFn: () => voipApi.initiateCall({
      to_number: callTo,
      from_number: callFrom || undefined,
      notes: callNotes || undefined,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["voip-calls"] });
      setCallDialogOpen(false);
      resetCallForm();
      if (data.demo_mode) {
        toast.success("Demo call simulated successfully");
      } else {
        toast.success("Call initiated successfully");
      }
    },
    onError: () => toast.error("Failed to initiate call"),
  });
  
  const smsMutation = useMutation({
    mutationFn: () => voipApi.sendSMS({
      to_number: smsTo,
      from_number: smsFrom || undefined,
      message: smsMessage,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["voip-sms"] });
      setSmsDialogOpen(false);
      resetSmsForm();
      if (data.demo_mode) {
        toast.success("Demo SMS simulated successfully");
      } else {
        toast.success("SMS sent successfully");
      }
    },
    onError: () => toast.error("Failed to send SMS"),
  });
  
  const resetCallForm = () => {
    setCallTo("");
    setCallFrom("");
    setCallNotes("");
  };
  
  const resetSmsForm = () => {
    setSmsTo("");
    setSmsFrom("");
    setSmsMessage("");
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  const formatPhoneNumber = (num: string) => {
    if (!num) return "";
    const cleaned = num.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11) {
      return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return num;
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communications</h1>
          <p className="text-sm text-muted-foreground">
            VoIP calls and SMS messaging
            {status && !status.enabled && (
              <Badge variant="outline" className="ml-2">Demo Mode</Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="send-sms-button">
                <MessageSquare className="w-4 h-4 mr-2" />
                Send SMS
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send SMS</DialogTitle>
                <DialogDescription>
                  Send a text message to a customer
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>To Number *</Label>
                  <Input
                    value={smsTo}
                    onChange={(e) => setSmsTo(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    data-testid="sms-to-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Number</Label>
                  <Select value={smsFrom} onValueChange={setSmsFrom}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers?.numbers.map((num) => (
                        <SelectItem key={num.id} value={num.number}>
                          {num.number} {num.name && `(${num.name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Message *</Label>
                  <Textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={4}
                    data-testid="sms-message-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSmsDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => smsMutation.mutate()} 
                  disabled={!smsTo || !smsMessage || smsMutation.isPending}
                >
                  {smsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="make-call-button">
                <Phone className="w-4 h-4 mr-2" />
                Make Call
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Make a Call</DialogTitle>
                <DialogDescription>
                  Initiate an outbound call
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>To Number *</Label>
                  <Input
                    value={callTo}
                    onChange={(e) => setCallTo(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    data-testid="call-to-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Number</Label>
                  <Select value={callFrom} onValueChange={setCallFrom}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select caller ID" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers?.numbers.map((num) => (
                        <SelectItem key={num.id} value={num.number}>
                          {num.number} {num.name && `(${num.name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Call notes..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCallDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => callMutation.mutate()} 
                  disabled={!callTo || callMutation.isPending}
                >
                  {callMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Call
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{analytics?.total_calls || 0}</p>
                <p className="text-xs text-muted-foreground">Total Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PhoneIncoming className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{analytics?.inbound_calls || 0}</p>
                <p className="text-xs text-muted-foreground">Inbound</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PhoneOutgoing className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{analytics?.outbound_calls || 0}</p>
                <p className="text-xs text-muted-foreground">Outbound</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PhoneMissed className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{analytics?.missed_calls || 0}</p>
                <p className="text-xs text-muted-foreground">Missed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {formatDuration(analytics?.average_duration_seconds || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calls" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="calls" className="mt-4">
          {callsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !callsData?.calls.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No calls yet</h3>
                <p className="text-muted-foreground">Make your first call to get started</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callsData.calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        {call.direction === "inbound" ? (
                          <PhoneIncoming className="w-4 h-4 text-blue-500" />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-green-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPhoneNumber(call.caller_number)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPhoneNumber(call.called_number)}
                      </TableCell>
                      <TableCell>
                        {call.customer_name ? (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {call.customer_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[call.status] || "bg-gray-500"}>
                          {call.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="sms" className="mt-4">
          {smsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !smsData?.messages.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                <p className="text-muted-foreground">Send your first SMS to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {smsData.messages.map((sms) => (
                <Card key={sms.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {sms.direction === "inbound" ? (
                            <Badge variant="outline" className="text-blue-600">Received</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">Sent</Badge>
                          )}
                          {sms.customer_name && (
                            <span className="text-sm font-medium">{sms.customer_name}</span>
                          )}
                        </div>
                        <p className="text-sm mb-2">{sms.message}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatPhoneNumber(sms.direction === "inbound" ? sms.from_number : sms.to_number)}</span>
                          <span>{formatDistanceToNow(new Date(sms.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="analytics" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calls by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.calls_by_status ? (
                  <div className="space-y-2">
                    {Object.entries(analytics.calls_by_status).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="capitalize">{status}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calls by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.calls_by_hour && Object.keys(analytics.calls_by_hour).length > 0 ? (
                  <div className="h-48 flex items-end justify-between gap-1">
                    {Array.from({ length: 24 }, (_, i) => {
                      const count = analytics.calls_by_hour[String(i)] || 0;
                      const maxCount = Math.max(...Object.values(analytics.calls_by_hour), 1);
                      const height = (count / maxCount) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${i}:00 - ${count} calls`}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Configuration Notice */}
      {status && !status.enabled && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                  VoIP Integration Not Configured
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  To enable real calling and SMS, configure your Phone.com credentials in Settings → Integrations.
                  The system is currently running in demo mode.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
