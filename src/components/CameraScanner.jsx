import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// Live barcode scanner. Cross-browser (iOS + Android) via ZXing.
// If the camera can't start or permission is denied, it surfaces a friendly
// message and hands back to manual entry — it never blocks the flow.
export default function CameraScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const doneRef = useRef(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128,
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 300 });

    (async () => {
      try {
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result, _e, controls) => {
            if (result && !doneRef.current) {
              doneRef.current = true;
              try { controls.stop(); } catch {}
              onDetected(result.getText());
            }
          }
        );
      } catch (e) {
        setErr(e && e.name === "NotAllowedError" ? "denied" : "error");
      }
    })();

    return () => { doneRef.current = true; try { controlsRef.current && controlsRef.current.stop(); } catch {} };
  }, [onDetected]);

  if (err) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ember">
          {err === "denied"
            ? "Camera access is needed to scan barcodes. You can also enter the barcode manually below."
            : "Couldn't start the camera on this device. Enter the barcode manually instead."}
        </p>
        <button onClick={onClose} className="btn-primary w-full">Enter barcode manually</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "3 / 4" }}>
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-gold/80" />
      </div>
      <p className="text-center text-sm text-muted">Point at the barcode and hold steady.</p>
      <button onClick={onClose} className="pill mx-auto block px-6 py-2">Cancel / enter manually</button>
    </div>
  );
}
