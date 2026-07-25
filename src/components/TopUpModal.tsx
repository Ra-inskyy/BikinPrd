import { useMutation } from "convex/react";
import { Check, CreditCard, Loader2, QrCode, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

const PACKAGES = [
  {
    id: "hemat",
    name: "Paket Hemat",
    credits: 5,
    price: 10000,
    priceFormatted: "Rp 10.000",
    desc: "Cocok untuk eksplorasi ide cepat",
    popular: false,
    icon: Zap,
  },
  {
    id: "pro",
    name: "Paket Pro",
    credits: 15,
    price: 25000,
    priceFormatted: "Rp 25.000",
    desc: "Paling hemat untuk developer aktif",
    popular: true,
    icon: Sparkles,
  },
  {
    id: "sultan",
    name: "Paket Sultan",
    credits: 35,
    price: 50000,
    priceFormatted: "Rp 50.000",
    desc: "Maksimal untuk agensi & indie hacker",
    popular: false,
    icon: CreditCard,
  },
];

export function TopUpModal({
  triggerText = "Top-Up Kredit",
  variant = "outline",
  size = "sm",
}: {
  triggerText?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<typeof PACKAGES[0] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const topUpMutation = useMutation(api.prd.topUpCredits);

  const handlePay = async (pkg: typeof PACKAGES[0]) => {
    setSelectedPkg(pkg);
    setIsProcessing(true);

    try {
      // Simulasi delay pembayaran via Payment Gateway / QRIS
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await topUpMutation({
        packageName: pkg.name,
        amount: pkg.price,
        creditsAdded: pkg.credits,
      });

      toast.success(`Pembayaran Berhasil! +${pkg.credits} Kredit PRD ditambahkan.`);
      setOpen(false);
    } catch (err: any) {
      const message =
        err?.data ?? err?.message ?? "Gagal memproses pembayaran. Coba lagi.";
      toast.error(`Ditolak: ${message}`);
    } finally {
      setIsProcessing(false);
      setSelectedPkg(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className="gap-1.5 font-semibold text-xs border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-all"
        >
          <Zap className="size-3.5 fill-primary text-primary" />
          {triggerText}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-6">
        <DialogHeader className="space-y-2 text-center sm:text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-heading font-bold">
            <Sparkles className="size-5 text-primary" />
            Top-Up Kredit PRD
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Beli kredit tambahan untuk membuat PRD kapan saja tanpa harus menunggu kuota harian di-reset.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            const isLoadingThis = isProcessing && selectedPkg?.id === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`relative rounded-xl border p-4 transition-all ${
                  pkg.popular
                    ? "border-primary/60 bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-primary-foreground">
                    Paling Populer
                  </span>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        {pkg.name}
                        <span className="text-xs text-primary font-mono font-bold">
                          (+{pkg.credits} PRD)
                        </span>
                      </h4>
                      <p className="text-xs text-muted-foreground">{pkg.desc}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-sm">{pkg.priceFormatted}</p>
                    <Button
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => handlePay(pkg)}
                      className="mt-1 h-8 px-3 text-xs font-semibold"
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        "Beli"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <QrCode className="size-4 text-primary shrink-0" />
            Pembayaran Instan (QRIS & E-Wallet)
          </span>
          <span className="flex items-center gap-1">
            <Check className="size-3.5 text-primary" /> Kredit Aktif Instan
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
