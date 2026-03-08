import { useEffect, useRef, useState } from "react";

interface Props {
  instancePort: string;
  instanceId: string;
  tabId: string;
  label: string;
  url: string;
  quality?: number;
  maxWidth?: number;
  fps?: number;
}

type Status = "connecting" | "streaming" | "error";

export default function ScreencastTile({
  instancePort: _instancePort,
  instanceId,
  tabId,
  label,
  url,
  quality = 30,
  maxWidth = 800,
  fps = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [fpsDisplay, setFpsDisplay] = useState("—");
  const [sizeDisplay, setSizeDisplay] = useState("—");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      if (destroyed) return;
      setStatus("connecting");

      // Step 1: Get the direct WebSocket URL from the proxy/screencast endpoint
      // This avoids the httputil.ReverseProxy which doesn't correctly handle
      // binary WebSocket frames for the screencast stream.
      let wsUrl: string;
      try {
        const resp = await fetch(
          `/instances/${instanceId}/proxy/screencast?tabId=${encodeURIComponent(tabId)}&quality=${quality}&maxWidth=${maxWidth}&fps=${fps}`
        );
        if (!resp.ok) throw new Error(`proxy/screencast returned ${resp.status}`);
        const data = await resp.json();
        wsUrl = data.wsUrl;
        if (!wsUrl) throw new Error("no wsUrl in response");
      } catch (err) {
        console.warn("ScreencastTile: could not get direct WS URL, falling back to proxy", err);
        // Fallback: connect through orchestrator proxy directly
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${wsProtocol}//${window.location.host}/instances/${instanceId}/screencast?tabId=${encodeURIComponent(tabId)}&quality=${quality}&maxWidth=${maxWidth}&fps=${fps}`;
      }

      if (destroyed) return;

      const socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      let frameCount = 0;
      let lastFpsTime = Date.now();

      socket.onopen = () => {
        if (!destroyed) setStatus("streaming");
      };

      socket.onmessage = (evt) => {
        if (destroyed || !canvas || !ctx) return;

        const blob = new Blob([evt.data], { type: "image/jpeg" });
        const imgUrl = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          if (destroyed || !canvas || !ctx) {
            URL.revokeObjectURL(imgUrl);
            return;
          }
          if (img.naturalWidth > 0 && canvas.width !== img.naturalWidth) {
            canvas.width = img.naturalWidth;
          }
          if (img.naturalHeight > 0 && canvas.height !== img.naturalHeight) {
            canvas.height = img.naturalHeight;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(imgUrl);
        };

        img.onerror = () => URL.revokeObjectURL(imgUrl);
        img.src = imgUrl;

        frameCount++;
        const now = Date.now();
        if (now - lastFpsTime >= 1000) {
          setFpsDisplay(`${frameCount} fps`);
          setSizeDisplay(`${(evt.data.byteLength / 1024).toFixed(0)} KB/frame`);
          frameCount = 0;
          lastFpsTime = now;
        }
      };

      socket.onerror = () => {
        if (!destroyed) setStatus("error");
      };

      socket.onclose = () => {
        if (!destroyed) {
          setStatus("error");
          reconnectTimer = setTimeout(() => {
            if (!destroyed) connect();
          }, 2000);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const s = socketRef.current;
      if (s) {
        s.onclose = null;
        s.close();
        socketRef.current = null;
      }
    };
  }, [instanceId, tabId, quality, maxWidth, fps]);

  const statusColor =
    status === "streaming"
      ? "bg-success"
      : status === "connecting"
        ? "bg-warning"
        : "bg-destructive";

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-text-secondary">{label}</span>
          <div className={`h-2 w-2 rounded-full ${statusColor}`} />
        </div>
        <span className="max-w-50 truncate text-xs text-text-muted">{url}</span>
      </div>

      {/* Canvas */}
      <div className="relative aspect-video bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full object-contain"
          width={800}
          height={600}
        />
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-text-muted">
            Reconnecting...
          </div>
        )}
        {status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-text-muted">
            Connecting...
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between border-t border-border-subtle px-3 py-1 text-xs text-text-muted">
        <span>{fpsDisplay}</span>
        <span>{sizeDisplay}</span>
      </div>
    </div>
  );
}
