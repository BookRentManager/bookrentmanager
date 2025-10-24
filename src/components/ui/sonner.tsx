import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:border-l-4 group-[.toaster]:border-l-king-gold group-[.toaster]:shadow-[var(--shadow-elevated)] backdrop-blur-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-king-gold group-[.toast]:text-king-black group-[.toast]:hover:bg-king-gold/90 group-[.toast]:font-medium group-[.toast]:transition-colors",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted/80",
          success: "group-[.toast]:border-l-success",
          error: "group-[.toast]:border-l-destructive",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
