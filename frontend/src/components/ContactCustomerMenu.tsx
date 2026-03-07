import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from './ui/use-toast';
import {
  Phone,
  PhoneCall,
  Mail,
  MessageSquare,
  MessageCircle,
  MoreHorizontal,
  Loader2,
  User,
} from 'lucide-react';
import { voipApi } from '../lib/api';

export interface ContactInfo {
  name: string;
  phone?: string | null;
  email?: string | null;
  customerId?: string;
  jobId?: string;
}

interface ContactCustomerMenuProps {
  contact: ContactInfo;
  onOpenChat?: () => void;
  variant?: 'icon' | 'button' | 'dropdown';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function ContactCustomerMenu({
  contact,
  onOpenChat,
  variant = 'dropdown',
  size = 'default',
  className = '',
}: ContactCustomerMenuProps) {
  const { toast } = useToast();
  const [isCallingCustomer, setIsCallingCustomer] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingSMS, setIsSendingSMS] = useState(false);

  // Click-to-call handler
  const handleClickToCall = async () => {
    if (!contact.phone) {
      toast({
        title: "No Phone Number",
        description: "This contact doesn't have a phone number on file.",
        variant: "destructive",
      });
      return;
    }
    
    setIsCallingCustomer(true);
    try {
      const result = await voipApi.initiateCall({
        to_number: contact.phone,
        customer_id: contact.customerId,
        job_id: contact.jobId,
        notes: `Call to ${contact.name}`,
      });
      
      if (result.success) {
        toast({
          title: result.demo_mode ? "Demo Call" : "Call Initiated",
          description: result.demo_mode 
            ? `Simulated call to ${contact.name}` 
            : `Connecting to ${contact.name}`,
        });
      } else {
        throw new Error("Call failed");
      }
    } catch (error) {
      toast({
        title: "Call Failed",
        description: "Could not initiate call. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCallingCustomer(false);
    }
  };

  // SMS handler
  const handleSendSMS = async () => {
    if (!contact.phone) {
      toast({
        title: "No Phone Number",
        description: "This contact doesn't have a phone number on file.",
        variant: "destructive",
      });
      return;
    }

    if (!smsMessage.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message to send.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSendingSMS(true);
    try {
      const result = await voipApi.sendSMS({
        to_number: contact.phone,
        message: smsMessage,
        customer_id: contact.customerId,
        job_id: contact.jobId,
      });
      
      if (result.success) {
        toast({
          title: result.demo_mode ? "Demo SMS" : "SMS Sent",
          description: result.demo_mode 
            ? `Simulated SMS to ${contact.name}` 
            : `Message sent to ${contact.name}`,
        });
        setShowSMSDialog(false);
        setSmsMessage('');
      } else {
        throw new Error("SMS failed");
      }
    } catch (error) {
      toast({
        title: "SMS Failed",
        description: "Could not send SMS. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingSMS(false);
    }
  };

  // Email handler (opens default mail client)
  const handleSendEmail = () => {
    if (!contact.email) {
      toast({
        title: "No Email",
        description: "This contact doesn't have an email address on file.",
        variant: "destructive",
      });
      return;
    }

    const subject = encodeURIComponent(emailSubject || `Message from BreezeFlow`);
    const body = encodeURIComponent(emailBody || '');
    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
    setShowEmailDialog(false);
    setEmailSubject('');
    setEmailBody('');
  };

  // Quick email (direct link)
  const handleQuickEmail = () => {
    if (!contact.email) {
      toast({
        title: "No Email",
        description: "This contact doesn't have an email address on file.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = `mailto:${contact.email}`;
  };

  // Render single icon button variant
  if (variant === 'icon') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className={className}
              data-testid="contact-customer-menu"
            >
              <Phone className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="flex items-center gap-2">
              <User className="w-3 h-3" />
              <span className="truncate">{contact.name}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={handleClickToCall}
              disabled={!contact.phone || isCallingCustomer}
              data-testid="contact-call-btn"
            >
              {isCallingCustomer ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PhoneCall className="w-4 h-4 mr-2" />
              )}
              Call {contact.phone ? '' : '(No number)'}
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => contact.phone ? setShowSMSDialog(true) : null}
              disabled={!contact.phone}
              data-testid="contact-sms-btn"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Text SMS {contact.phone ? '' : '(No number)'}
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={handleQuickEmail}
              disabled={!contact.email}
              data-testid="contact-email-btn"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email {contact.email ? '' : '(No email)'}
            </DropdownMenuItem>
            
            {onOpenChat && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenChat} data-testid="contact-chat-btn">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Open Chat
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* SMS Dialog */}
        <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send SMS to {contact.name}</DialogTitle>
              <DialogDescription>
                Sending to: {contact.phone}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sms-message">Message</Label>
                <Textarea
                  id="sms-message"
                  placeholder="Type your message..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={4}
                  maxLength={1600}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {smsMessage.length}/1600 characters
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSMSDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendSMS} disabled={isSendingSMS || !smsMessage.trim()}>
                {isSendingSMS ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send SMS
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Render button variant (shows as a single button with dropdown)
  if (variant === 'button') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size={size}
              className={className}
              data-testid="contact-customer-btn"
            >
              <Phone className="w-4 h-4 mr-2" />
              Contact
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <User className="w-3 h-3" />
              <span className="truncate">{contact.name}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={handleClickToCall}
              disabled={!contact.phone || isCallingCustomer}
              data-testid="contact-call-btn"
            >
              {isCallingCustomer ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PhoneCall className="w-4 h-4 mr-2 text-green-600" />
              )}
              <div className="flex flex-col">
                <span>Call Customer</span>
                {contact.phone && <span className="text-xs text-muted-foreground">{contact.phone}</span>}
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => contact.phone ? setShowSMSDialog(true) : null}
              disabled={!contact.phone}
              data-testid="contact-sms-btn"
            >
              <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
              <div className="flex flex-col">
                <span>Send Text SMS</span>
                {contact.phone && <span className="text-xs text-muted-foreground">{contact.phone}</span>}
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => contact.email ? setShowEmailDialog(true) : null}
              disabled={!contact.email}
              data-testid="contact-email-btn"
            >
              <Mail className="w-4 h-4 mr-2 text-orange-600" />
              <div className="flex flex-col">
                <span>Send Email</span>
                {contact.email && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{contact.email}</span>}
              </div>
            </DropdownMenuItem>
            
            {onOpenChat && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenChat} data-testid="contact-chat-btn">
                  <MessageCircle className="w-4 h-4 mr-2 text-purple-600" />
                  Open Job Chat
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* SMS Dialog */}
        <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send SMS to {contact.name}</DialogTitle>
              <DialogDescription>
                Sending to: {contact.phone}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sms-message-btn">Message</Label>
                <Textarea
                  id="sms-message-btn"
                  placeholder="Type your message..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={4}
                  maxLength={1600}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {smsMessage.length}/1600 characters
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSMSDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendSMS} disabled={isSendingSMS || !smsMessage.trim()}>
                {isSendingSMS ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send SMS
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Email Dialog */}
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email {contact.name}</DialogTitle>
              <DialogDescription>
                Sending to: {contact.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  placeholder="Email subject..."
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email-body">Message (optional)</Label>
                <Textarea
                  id="email-body"
                  placeholder="Type your message..."
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail}>
                <Mail className="w-4 h-4 mr-2" />
                Open Email Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Default dropdown variant (full menu with more options icon)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className={className}
            data-testid="contact-customer-dropdown"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Contact {contact.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={handleClickToCall}
            disabled={!contact.phone || isCallingCustomer}
          >
            {isCallingCustomer ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PhoneCall className="w-4 h-4 mr-2 text-green-600" />
            )}
            Call {contact.phone || '(No number)'}
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => contact.phone ? setShowSMSDialog(true) : null}
            disabled={!contact.phone}
          >
            <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
            Text SMS {contact.phone ? '' : '(No number)'}
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={handleQuickEmail}
            disabled={!contact.email}
          >
            <Mail className="w-4 h-4 mr-2 text-orange-600" />
            Email {contact.email ? '' : '(No email)'}
          </DropdownMenuItem>
          
          {onOpenChat && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenChat}>
                <MessageCircle className="w-4 h-4 mr-2 text-purple-600" />
                Open Chat
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* SMS Dialog */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS to {contact.name}</DialogTitle>
            <DialogDescription>
              Sending to: {contact.phone}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sms-message-dropdown">Message</Label>
              <Textarea
                id="sms-message-dropdown"
                placeholder="Type your message..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={4}
                maxLength={1600}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {smsMessage.length}/1600 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSMSDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendSMS} disabled={isSendingSMS || !smsMessage.trim()}>
              {isSendingSMS ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send SMS
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Quick action buttons (individual buttons for each action)
export function ContactQuickActions({
  contact,
  onOpenChat,
  showLabels = false,
  className = '',
}: ContactCustomerMenuProps & { showLabels?: boolean }) {
  const { toast } = useToast();
  const [isCallingCustomer, setIsCallingCustomer] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [isSendingSMS, setIsSendingSMS] = useState(false);

  const handleClickToCall = async () => {
    if (!contact.phone) {
      toast({
        title: "No Phone Number",
        description: "This contact doesn't have a phone number on file.",
        variant: "destructive",
      });
      return;
    }
    
    setIsCallingCustomer(true);
    try {
      const result = await voipApi.initiateCall({
        to_number: contact.phone,
        customer_id: contact.customerId,
        job_id: contact.jobId,
        notes: `Call to ${contact.name}`,
      });
      
      if (result.success) {
        toast({
          title: result.demo_mode ? "Demo Call" : "Call Initiated",
          description: result.demo_mode 
            ? `Simulated call to ${contact.name}` 
            : `Connecting to ${contact.name}`,
        });
      }
    } catch (error) {
      toast({
        title: "Call Failed",
        description: "Could not initiate call.",
        variant: "destructive",
      });
    } finally {
      setIsCallingCustomer(false);
    }
  };

  const handleSendSMS = async () => {
    if (!contact.phone || !smsMessage.trim()) return;
    
    setIsSendingSMS(true);
    try {
      const result = await voipApi.sendSMS({
        to_number: contact.phone,
        message: smsMessage,
        customer_id: contact.customerId,
        job_id: contact.jobId,
      });
      
      if (result.success) {
        toast({
          title: result.demo_mode ? "Demo SMS" : "SMS Sent",
          description: `Message sent to ${contact.name}`,
        });
        setShowSMSDialog(false);
        setSmsMessage('');
      }
    } catch (error) {
      toast({
        title: "SMS Failed",
        description: "Could not send SMS.",
        variant: "destructive",
      });
    } finally {
      setIsSendingSMS(false);
    }
  };

  const handleQuickEmail = () => {
    if (contact.email) {
      window.location.href = `mailto:${contact.email}`;
    } else {
      toast({
        title: "No Email",
        description: "This contact doesn't have an email address.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className={`flex items-center gap-1 ${className}`}>
        {/* Call Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClickToCall}
          disabled={!contact.phone || isCallingCustomer}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
          title={contact.phone ? `Call ${contact.phone}` : 'No phone number'}
          data-testid="quick-call-btn"
        >
          {isCallingCustomer ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PhoneCall className="w-4 h-4" />
          )}
          {showLabels && <span className="ml-1">Call</span>}
        </Button>

        {/* SMS Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => contact.phone ? setShowSMSDialog(true) : null}
          disabled={!contact.phone}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          title={contact.phone ? `Text ${contact.phone}` : 'No phone number'}
          data-testid="quick-sms-btn"
        >
          <MessageSquare className="w-4 h-4" />
          {showLabels && <span className="ml-1">SMS</span>}
        </Button>

        {/* Email Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleQuickEmail}
          disabled={!contact.email}
          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          title={contact.email ? `Email ${contact.email}` : 'No email address'}
          data-testid="quick-email-btn"
        >
          <Mail className="w-4 h-4" />
          {showLabels && <span className="ml-1">Email</span>}
        </Button>

        {/* Chat Button */}
        {onOpenChat && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenChat}
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            title="Open chat"
            data-testid="quick-chat-btn"
          >
            <MessageCircle className="w-4 h-4" />
            {showLabels && <span className="ml-1">Chat</span>}
          </Button>
        )}
      </div>

      {/* SMS Dialog */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS to {contact.name}</DialogTitle>
            <DialogDescription>
              Sending to: {contact.phone}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quick-sms-message">Message</Label>
              <Textarea
                id="quick-sms-message"
                placeholder="Type your message..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={4}
                maxLength={1600}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {smsMessage.length}/1600 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSMSDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendSMS} disabled={isSendingSMS || !smsMessage.trim()}>
              {isSendingSMS ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send SMS
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ContactCustomerMenu;
