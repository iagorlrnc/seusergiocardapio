import { useState, useRef } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { X, Download, Share2, Copy } from "lucide-react";

interface QRCodeGeneratorProps {
  userSlug: string;
  onClose: () => void;
}

export function QRCodeGenerator({ userSlug, onClose }: QRCodeGeneratorProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Gerar URL completa do usuário (domínio + slug)
  const userUrl = `${window.location.origin}/${userSlug}`;
  const qrValue = userUrl;

  const downloadQRCode = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `pedido-qrcode.png`;
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const shareQRCode = async () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const url = canvas.toDataURL("image/png");

      if (navigator.share) {
        try {
          const blob = await (await fetch(url)).blob();
          const file = new File([blob], "pedido-qrcode.png", {
            type: "image/png",
          });

          await navigator.share({
            title: "Seu Sérgio - Pedido",
            text: `Acesse ${userUrl}`,
            files: [file],
          });
        } catch (error) {
          console.error("Erro ao compartilhar:", error);
        }
      } else {
        handleCopy();
      }
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(userUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Compartilhar Pedido
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-6">
          <p className="text-gray-600 text-sm mb-4">
            Compartilhe este QR code com outra pessoa para que ela possa
            adicionar itens ao seu pedido
          </p>

          <div
            ref={qrRef}
            className="flex justify-center p-4 bg-gray-50 rounded-lg"
          >
            <QRCode
              value={qrValue}
              size={256}
              level="H"
              includeMargin={true}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-xs text-gray-500 mt-4 break-all">{userUrl}</p>
        </div>

        <div className="space-y-2">
          <button
            onClick={downloadQRCode}
            className="w-full flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            <Download className="w-4 h-4" />
            Baixar QR Code
          </button>

          <button
            onClick={shareQRCode}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            <Share2 className="w-4 h-4" />
            Compartilhar
          </button>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            <Copy className="w-4 h-4" />
            {copied ? "Copiado!" : "Copiar Link"}
          </button>

          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
