"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Camera,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_MB = 8;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/**
 * Cargador de imágenes con múltiples fuentes: explorador de archivos, cámara
 * en vivo (getUserMedia), arrastrar y soltar, y pegar desde el portapapeles.
 * Sube al bucket público `inventory` y devuelve las URLs mediante onChange.
 * La primera imagen es la principal (portada).
 */
export function ImageUploader({
  orgId,
  value,
  onChange,
  disabled,
}: {
  orgId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const subir = useCallback(
    async (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) return;
      setUploading((n) => n + imgs.length);
      const nuevas: string[] = [];
      for (const file of imgs) {
        if (!ACCEPT.includes(file.type)) {
          toast.error(`Formato no soportado: ${file.name}`);
          setUploading((n) => n - 1);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`${file.name} supera ${MAX_MB} MB`);
          setUploading((n) => n - 1);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("inventory")
          .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (error) {
          toast.error(`No se pudo subir ${file.name}: ${error.message}`);
        } else {
          const { data } = supabase.storage.from("inventory").getPublicUrl(path);
          nuevas.push(data.publicUrl);
        }
        setUploading((n) => n - 1);
      }
      if (nuevas.length > 0) {
        onChange([...value, ...nuevas]);
        toast.success(`${nuevas.length} imagen(es) agregada(s)`);
      }
    },
    [orgId, supabase, value, onChange]
  );

  // Pegar imágenes (Ctrl/Cmd+V) cuando la zona está enfocada/visible
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (disabled) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) {
        e.preventDefault();
        void subir(files);
      }
    }
    const el = zoneRef.current;
    el?.addEventListener("paste", onPaste as EventListener);
    return () => el?.removeEventListener("paste", onPaste as EventListener);
  }, [subir, disabled]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    void subir(Array.from(e.dataTransfer.files));
  }

  function quitar(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  function hacerPrincipal(url: string) {
    onChange([url, ...value.filter((u) => u !== url)]);
  }

  return (
    <div className="space-y-3">
      {/* Zona de carga */}
      <div
        ref={zoneRef}
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && fileRef.current?.click()}
        role="button"
        aria-label="Agregar imágenes"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
          dragOver ? "border-primary bg-accent" : "border-input hover:border-primary/50 hover:bg-accent/40",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {uploading > 0 ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
        </div>
        <p className="text-sm font-medium">
          {uploading > 0 ? `Subiendo ${uploading}…` : "Arrastra imágenes aquí o haz clic"}
        </p>
        <p className="text-xs text-muted-foreground">
          Explorador, cámara o pegar (Ctrl/⌘+V) · JPG, PNG, WEBP · máx {MAX_MB} MB
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
            disabled={disabled}
          >
            <Upload className="h-4 w-4" /> Explorador
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setCameraOpen(true);
            }}
            disabled={disabled}
          >
            <Camera className="h-4 w-4" /> Cámara
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void subir(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      {/* Miniaturas */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((url, i) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              <Image
                src={url}
                alt={`Imagen ${i + 1}`}
                fill
                sizes="120px"
                className="object-cover"
                unoptimized
              />
              {i === 0 && (
                <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  <Star className="h-2.5 w-2.5" /> Portada
                </span>
              )}
              {!disabled && (
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => hacerPrincipal(url)}
                      title="Marcar como portada"
                      className="rounded-full bg-white/90 p-1.5 text-slate-800 hover:bg-white"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => quitar(url)}
                    title="Quitar"
                    className="rounded-full bg-white/90 p-1.5 text-red-600 hover:bg-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            void subir([file]);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Captura con cámara en vivo (getUserMedia + canvas snapshot)
// ─────────────────────────────────────────────────────────────
function CameraCapture({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError(
          "No se pudo acceder a la cámara. Revisa los permisos del navegador o usa el explorador."
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capturar() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `camara-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Camera className="h-4 w-4 text-primary" /> Tomar foto
          </span>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative aspect-video bg-black">
          {error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
              {error}
            </div>
          ) : (
            <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t p-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={capturar} disabled={!ready || !!error}>
            <Camera className="h-4 w-4" /> Capturar
          </Button>
        </div>
      </div>
    </div>
  );
}
