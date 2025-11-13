import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Download, Share, Smartphone, Zap, Wifi } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    
    // Detect mobile (iOS or Android)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Don't show on desktop
    if (!isMobile) {
      return;
    }

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isDismissed = localStorage.getItem('installPromptDismissed') === 'true';
    const shownThisSession = sessionStorage.getItem('installPromptShown') === 'true';

    if (isStandalone || isDismissed || shownThisSession) {
      return;
    }

    // For Android - capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show prompt after 6 seconds (increased from 2)
    const timer = setTimeout(() => {
      setShowPrompt(true);
      sessionStorage.setItem('installPromptShown', 'true');
    }, 6000);

    // Auto-dismiss after 10 seconds (increased from 5)
    const autoDismiss = setTimeout(() => {
      setShowPrompt(false);
    }, 16000); // 6s delay + 10s visible

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(timer);
      clearTimeout(autoDismiss);
    };
  }, []);

  const handleInstall = async () => {
    if (!isIOS && deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
        localStorage.setItem('installPromptDismissed', 'true');
      }
      setDeferredPrompt(null);
    }
  };

  const handleRemindLater = () => {
    setShowPrompt(false);
    // Already marked in sessionStorage, won't show again this session
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 shadow-2xl animate-in slide-in-from-bottom-4 border-primary/20 backdrop-blur-sm bg-background/95">
      <div className="relative">
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-lg overflow-hidden shadow-md ring-1 ring-primary/20 flex-shrink-0">
            <img 
              src="/icons/icon-192x192.png" 
              alt="BookRentManager" 
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install BookRentManager</h3>
            <p className="text-xs text-muted-foreground">Quick access from your home screen</p>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDismiss} 
            className="h-8 w-8 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          {isIOS ? (
            <>
              <Button 
                onClick={handleRemindLater}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
              >
                Later
              </Button>
              <Button 
                onClick={handleDismiss} 
                variant="ghost" 
                size="sm"
                className="text-xs"
              >
                Don't show again
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleInstall}
                size="sm"
                className="flex-1 text-xs"
                disabled={!deferredPrompt}
              >
                <Download className="h-3 w-3 mr-1.5" />
                Install
              </Button>
              <Button 
                onClick={handleRemindLater}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Later
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
