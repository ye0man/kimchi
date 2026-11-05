import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { IconCamera, IconKeyboard } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Camera QR scanner with a paste fallback for devices without a camera. */
export function QrScanDialog({
  open,
  onOpenChange,
  onResult,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 250,
    });
    void (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result) => {
            if (!result) return;
            controls.stop();
            controlsRef.current = null;
            resultRef.current(result.getText());
          },
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Camera unavailable. Paste the code instead.",
        );
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  const submitManual = () => {
    if (!manual.trim()) return;
    onResult(manual.trim());
    setManual("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCamera size={20} /> Scan a code
          </DialogTitle>
          <DialogDescription>
            Scan a Kimchi invite card, join link, or npub.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-3xl border border-kimchi-line bg-kimchi-ink">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-square w-full object-cover opacity-90"
          />
          <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/70" />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-kimchi-ink/85 p-4 text-center text-xs font-bold text-white">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-kimchi-line bg-kimchi-soft/60 p-3">
          <div className="flex items-center gap-1.5 text-xs font-black text-muted-foreground">
            <IconKeyboard size={14} /> Or paste it
          </div>
          <div className="flex gap-2">
            <Input
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitManual();
              }}
              placeholder="npub1… or a Kimchi link"
              className="min-w-0 flex-1"
            />
            <Button onClick={submitManual} disabled={!manual.trim()}>
              Use
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
