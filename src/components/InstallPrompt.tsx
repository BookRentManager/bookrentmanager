import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Download, Share } from 'lucide-react';

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

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isDismissed = localStorage.getItem('installPromptDismissed') === 'true';

    if (isStandalone || isDismissed) {
      return;
    }

    // For Android - capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show prompt after 2 seconds
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 2000);

    // Auto-dismiss after 10 seconds
    const autoDismiss = setTimeout(() => {
      setShowPrompt(false);
    }, 12000);

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

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 shadow-luxury animate-in slide-in-from-bottom-4">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-accent" />
            <h3 className="font-semibold">Install BookRentManager</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-6 w-6 -mt-1 -mr-1">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          {isIOS 
            ? "Add to your home screen for a better experience!"
            : "Get the app experience - install to your home screen!"
          }
        </p>

        {isIOS ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Tap <Share className="h-3 w-3 inline mx-1" /> Share, then "Add to Home Screen"
            </p>
            <Button variant="secondary" size="sm" onClick={handleDismiss} className="w-full">
              Got it
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Not Now
            </Button>
            <Button size="sm" onClick={handleInstall} className="flex-1">
              Install
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
