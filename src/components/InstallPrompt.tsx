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

    // Auto-dismiss after 15 seconds
    const autoDismiss = setTimeout(() => {
      setShowPrompt(false);
    }, 15000);

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
    <Card className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[420px] z-50 shadow-2xl animate-in slide-in-from-bottom-4 border-primary/20">
      <div className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
        
        <div className="relative p-5">
          {/* Header with App Icon Preview */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg ring-2 ring-primary/20">
                  <img 
                    src="/icons/icon-192x192.png" 
                    alt="BookRentManager" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-md animate-pulse-subtle">
                  <Download className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg">Install App</h3>
                <p className="text-xs text-muted-foreground">BookRentManager</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleDismiss} 
              className="h-8 w-8 -mt-1 -mr-1 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Platform-Specific Content */}
          {isIOS ? (
            <div className="space-y-4">
              {/* iOS Visual Guide */}
              <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Tap the Share button</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded border border-border animate-bounce-subtle">
                        <Share className="h-3 w-3 text-primary" />
                        <span>Share</span>
                      </div>
                      <span>at the bottom of Safari</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Scroll and select</p>
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded border border-accent/50 text-xs">
                      <Download className="h-3 w-3 text-accent" />
                      <span className="font-medium">"Add to Home Screen"</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Tap "Add"</p>
                    <p className="text-xs text-muted-foreground">The app will appear on your home screen</p>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-xs text-muted-foreground">Quick Access</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                    <Zap className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-xs text-muted-foreground">Faster</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                    <Wifi className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-xs text-muted-foreground">Offline Ready</span>
                </div>
              </div>

              <Button 
                variant="secondary" 
                size="lg" 
                onClick={handleDismiss} 
                className="w-full"
              >
                Got it!
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Android Install Guide */}
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg p-4 border border-accent/20">
                <p className="text-sm font-medium mb-3 text-center">
                  Install for the best experience
                </p>
                
                {/* Benefits Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-sm">
                      <Smartphone className="h-5 w-5 text-accent" />
                    </div>
                    <span className="text-xs font-medium">Quick Access</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-sm">
                      <Zap className="h-5 w-5 text-accent" />
                    </div>
                    <span className="text-xs font-medium">Faster</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-sm">
                      <Wifi className="h-5 w-5 text-accent" />
                    </div>
                    <span className="text-xs font-medium">Offline</span>
                  </div>
                </div>

                {/* App Preview */}
                <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mb-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-lg">🌐</span>
                    </div>
                    <span>Browser</span>
                  </div>
                  <span className="text-lg">→</span>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shadow-md ring-2 ring-accent/50">
                      <img 
                        src="/icons/icon-192x192.png" 
                        alt="App Icon" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="font-medium">Home Screen</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="lg" 
                  onClick={handleDismiss}
                  className="flex-1"
                >
                  Not Now
                </Button>
                <Button 
                  size="lg" 
                  onClick={handleInstall} 
                  className="flex-1 bg-accent hover:bg-accent/90 text-white font-semibold shadow-lg animate-pulse-subtle"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install Now
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
