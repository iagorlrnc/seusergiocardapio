import { QRCodeSVG } from "qrcode.react"
import { X, Share2, Copy } from "lucide-react"
import { useRef, useState } from "react"

interface UserQRCodeDisplayProps {
  username: string
  userSlug: string
  onClose: () => void
}

export function UserQRCodeDisplay({
  username,
  userSlug,
  onClose,
}: UserQRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // Gerar URL completa do usuário (domínio + slug)
  const userUrl = `${window.location.origin}/${userSlug}`

  const handleShare = async () => {
    const text = `QR Code da Mesa ${username}\n\n${userUrl}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Mesa ${username}`,
          text: text,
        })
      } catch (error) {
        console.error("Erro ao compartilhar:", error)
      }
    } else {
      handleCopy()
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(userUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <style>{`
        @media print {
          .qr-code-container {
            filter: blur(20px);
            opacity: 0.3;
          }
          .qr-code-container::after {
            content: "QR Code protegido - não disponível para impressão";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            font-weight: bold;
            text-align: center;
            filter: none;
            opacity: 1;
          }
        }
        .prevent-screenshot {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          pointer-events: auto;
        }
      `}</style>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 prevent-screenshot"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">QR Code da Mesa</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg mb-6 flex flex-col items-center relative qr-code-container">
            <p className="text-gray-600 mb-4 font-semibold">
              Mesa <span className="text-xl">{username}</span>
            </p>
            <div ref={qrRef} className="bg-white p-4 rounded">
              <QRCodeSVG
                value={userUrl}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center break-all">
              {userUrl}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleShare}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Compartilhar
            </button>

            <button
              onClick={handleCopy}
              className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copiado!" : "Copiar Link"}
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 text-gray-600 hover:text-gray-800 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}
