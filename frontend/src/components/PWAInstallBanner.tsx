import { usePWAInstall } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone } from "lucide-react";
import { useState } from "react";

export function PWAInstallBanner() {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already installed, can't install, or user dismissed
  if (isInstalled || !canInstall || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    const accepted = await install();
    if (!accepted) {
      setDismissed(true);
    }
  };

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4"
      data-testid="pwa-install-banner"
    >
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">Install BreezeFlow</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Get quick access, offline support, and push notifications.
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleInstall}
                data-testid="pwa-install-button"
              >
                <Download className="h-4 w-4 mr-1" />
                Install
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setDismissed(true)}
                data-testid="pwa-dismiss-button"
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 p-1 rounded hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
