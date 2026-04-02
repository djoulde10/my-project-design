import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser, Upload } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange: (data: string | null, type: "drawn" | "uploaded") => void;
}

export default function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [activeTab, setActiveTab] = useState("draw");

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { canvas, ctx };
  }, []);

  useEffect(() => {
    const result = getCtx();
    if (!result) return;
    const { canvas, ctx } = result;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [getCtx]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const result = getCtx();
    if (!result) return;
    const pos = getPos(e);
    result.ctx.beginPath();
    result.ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const result = getCtx();
    if (!result) return;
    const pos = getPos(e);
    result.ctx.lineTo(pos.x, pos.y);
    result.ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    if (canvas) {
      onSignatureChange(canvas.toDataURL("image/png"), "drawn");
    }
  };

  const clearCanvas = () => {
    const result = getCtx();
    if (!result) return;
    const { canvas, ctx } = result;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
    onSignatureChange(null, "drawn");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return; // 2MB max

    const reader = new FileReader();
    reader.onload = () => {
      onSignatureChange(reader.result as string, "uploaded");
    };
    reader.readAsDataURL(file);
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="draw">Dessiner</TabsTrigger>
        <TabsTrigger value="upload">Importer</TabsTrigger>
      </TabsList>

      <TabsContent value="draw" className="space-y-3">
        <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-background">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair touch-none"
            style={{ height: 200 }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-sm text-muted-foreground">Dessinez votre signature ici</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
          <Eraser className="w-4 h-4 mr-2" />Effacer
        </Button>
      </TabsContent>

      <TabsContent value="upload" className="space-y-3">
        <div className="space-y-2">
          <Label>Image de signature (PNG, JPG — max 2 Mo)</Label>
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
