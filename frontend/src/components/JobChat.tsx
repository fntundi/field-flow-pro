import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Users,
  User,
  MessageSquare,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCcw,
  ChevronDown,
} from "lucide-react";
import { chatApi, ChatMessage, ChatChannel } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JobChatProps {
  jobId: string;
  jobNumber: string;
  onUnreadChange?: (internal: number, customer: number) => void;
}

export function JobChat({ jobId, jobNumber, onUnreadChange }: JobChatProps) {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState<ChatChannel>("internal");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Handle scroll to show/hide scroll button
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, []);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const msgs = await chatApi.getMessages(jobId, activeChannel);
      setMessages(msgs.reverse()); // Reverse to show oldest first
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [jobId, activeChannel, scrollToBottom]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = chatApi.createWebSocket(jobId, activeChannel);
      
      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
        console.log(`WebSocket connected to ${jobId}/${activeChannel}`);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "message":
            setMessages((prev) => [...prev, data.data]);
            scrollToBottom();
            break;
          case "user_joined":
            setOnlineUsers((prev) => 
              prev.includes(data.user_name) ? prev : [...prev, data.user_name]
            );
            break;
          case "user_left":
            setOnlineUsers((prev) => prev.filter((u) => u !== data.user_name));
            break;
          case "online_users":
            setOnlineUsers(data.users || []);
            break;
          case "typing":
            // Could show typing indicator
            break;
          case "read":
            // Could update read receipts
            break;
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        wsRef.current = null;
        
        // Reconnect with exponential backoff
        if (!event.wasClean && reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnected(false);
    }
  }, [jobId, activeChannel, scrollToBottom]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send via WebSocket
        wsRef.current.send(JSON.stringify({
          type: "message",
          content: messageContent,
        }));
      } else {
        // Fallback to REST API
        await chatApi.postMessage(jobId, activeChannel, messageContent);
        fetchMessages(); // Refresh messages
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      setNewMessage(messageContent); // Restore message
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, jobId, activeChannel, fetchMessages]);

  // Handle Enter key
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Effect: Fetch messages on channel change
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Effect: Connect WebSocket
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Get initials from name
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-500/20 text-red-400";
      case "dispatcher": return "bg-blue-500/20 text-blue-400";
      case "technician": return "bg-emerald-500/20 text-emerald-400";
      case "customer": return "bg-purple-500/20 text-purple-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-[500px] border border-border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent" />
          <span className="font-medium text-sm">Job Chat</span>
          <Badge variant="outline" className="text-xs">
            {jobNumber}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <Wifi className="w-3 h-3" />
              <span>Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <WifiOff className="w-3 h-3" />
              <span>Disconnected</span>
            </div>
          )}
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{onlineUsers.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Channel Tabs */}
      <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as ChatChannel)} className="flex-1 flex flex-col">
        <div className="px-3 pt-2">
          <TabsList className="w-full h-8">
            <TabsTrigger value="internal" className="flex-1 text-xs gap-1" data-testid="chat-tab-internal">
              <Users className="w-3 h-3" />
              Internal
            </TabsTrigger>
            <TabsTrigger value="customer" className="flex-1 text-xs gap-1" data-testid="chat-tab-customer">
              <User className="w-3 h-3" />
              Customer
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeChannel} className="flex-1 mt-0 px-0 overflow-hidden flex flex-col">
          {/* Messages Area */}
          <div 
            className="flex-1 overflow-y-auto px-3 py-2 space-y-3"
            ref={scrollAreaRef}
            onScroll={handleScroll}
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Start the conversation!</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isOwnMessage = msg.sender_id === user?.id;
                  const isSystem = msg.message_type === "system";
                  
                  if (isSystem) {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-center"
                      >
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          {msg.content}
                        </span>
                      </motion.div>
                    );
                  }
                  
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-2",
                        isOwnMessage ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={msg.sender_avatar_url} />
                        <AvatarFallback className="text-xs bg-accent/20 text-accent">
                          {getInitials(msg.sender_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "flex flex-col max-w-[75%]",
                        isOwnMessage ? "items-end" : "items-start"
                      )}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium">{msg.sender_name}</span>
                          <Badge className={cn("text-[10px] px-1 py-0", getRoleBadgeColor(msg.sender_role))}>
                            {msg.sender_role}
                          </Badge>
                        </div>
                        <div className={cn(
                          "px-3 py-2 rounded-lg text-sm",
                          isOwnMessage 
                            ? "bg-accent text-accent-foreground rounded-br-sm" 
                            : "bg-muted rounded-bl-sm"
                        )}>
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button */}
          <AnimatePresence>
            {showScrollButton && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-16 left-1/2 -translate-x-1/2"
              >
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full shadow-lg"
                  onClick={scrollToBottom}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message Input */}
          <div className="p-3 border-t border-border bg-muted/30">
            <div className="flex gap-2">
              <Input
                placeholder={`Message ${activeChannel === "internal" ? "team" : "customer"}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sending}
                className="flex-1"
                data-testid="chat-message-input"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                data-testid="chat-send-button"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            {activeChannel === "customer" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Messages in this channel are visible to the customer
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default JobChat;
