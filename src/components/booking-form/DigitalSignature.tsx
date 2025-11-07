import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Check } from "lucide-react";

interface DigitalSignatureProps {
  onSignatureChange: (signatureData: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export const DigitalSignature = ({ onSignatureChange, disabled, className }: DigitalSignatureProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Detect touch device for adaptive stroke width
  const isTouchDevice = useMemo(() => 
    'ontouchstart' in window || navigator.maxTouchPoints > 0,
    []
  );

  const strokeWidth = useMemo(() => isTouchDevice ? 3 : 2, [isTouchDevice]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with retina display support
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Set drawing style with adaptive stroke width
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Handle window resize
    const handleResize = () => {
      const newRect = canvas.getBoundingClientRect();
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
      }
      
      canvas.width = newRect.width * dpr;
      canvas.height = newRect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "hsl(var(--foreground))";
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      if (tempCtx && hasSignature) {
        ctx.drawImage(tempCanvas, 0, 0);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [strokeWidth, hasSignature]);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    
    // Prevent page scrolling on touch devices
    if ('touches' in e) {
      e.preventDefault();
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [disabled]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    // Prevent page scrolling on touch devices
    if ('touches' in e) {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, disabled]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setHasSignature(true);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const signatureData = canvas.toDataURL("image/png");
      onSignatureChange(signatureData);
    }
  }, [isDrawing, onSignatureChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <Card className={`p-3 md:p-4 lg:p-6 ${className || ''}`}>
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm md:text-base font-medium">Digital Signature *</label>
            {hasSignature && (
              <div className="flex items-center gap-1 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-xs font-medium">Captured</span>
              </div>
            )}
          </div>
          {hasSignature && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSignature}
              disabled={disabled}
              className="h-9 min-w-[44px] px-3 touch-manipulation"
            >
              <X className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
        
        <div className="border-2 border-dashed border-border rounded-lg bg-muted/50 relative touch-none overflow-hidden">
          {/* Signature guide line */}
          <div className="absolute bottom-1/3 left-4 right-4 border-b border-dashed border-muted-foreground/20 pointer-events-none" />
          
          <canvas
            ref={canvasRef}
            className="w-full h-32 sm:h-36 md:h-40 lg:h-48 cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            aria-label="Digital signature canvas"
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs md:text-sm text-muted-foreground px-4 text-center font-medium">
                {isTouchDevice ? 'Sign here with your finger' : 'Sign here with your mouse'}
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground/70 px-4 text-center mt-1">
                Draw your signature above the line
              </p>
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          By signing above, you confirm that you have read and agree to the terms and conditions.
        </p>
      </div>
    </Card>
  );
};
