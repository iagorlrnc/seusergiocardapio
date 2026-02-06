import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, AlertCircle } from "lucide-react";

interface QRCodeReaderProps {
  onQRCodeDetected: (data: string) => void;
  onClose: () => void;
}

export function QRCodeReader({ onQRCodeDetected, onClose }: QRCodeReaderProps) {
  const [error, setError] = useState<string>("");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef(false);

  // Solicitar permissão de câmera
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        // Solicitar acesso à câmera com preferência pela câmera traseira (mobile)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        // Se conseguiu, parar o stream e marcar como permitido
        stream.getTracks().forEach((track) => track.stop());
        setPermissionGranted(true);
        setError("");
      } catch (err) {
        // Se negou ou há erro
        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError") {
            setError(
              "Permissão de câmera negada. Verifique as configurações do seu navegador.",
            );
          } else if (err.name === "NotFoundError") {
            setError("Nenhuma câmera encontrada neste dispositivo.");
          } else if (err.name === "NotReadableError") {
            setError("Câmera em uso por outro aplicativo. Tente novamente.");
          } else {
            setError("Erro ao acessar a câmera. " + err.message);
          }
        } else {
          setError("Erro desconhecido ao acessar a câmera.");
        }
        setPermissionGranted(false);
      } finally {
        setPermissionChecked(true);
      }
    };

    requestCameraPermission();
  }, []);

  // Iniciar scanner após permissão concedida
  useEffect(() => {
    if (
      !permissionGranted ||
      !permissionChecked ||
      scannerReady ||
      isScanning.current
    )
      return;

    const startScanner = async () => {
      try {
        isScanning.current = true;
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 300, height: 300 },
          aspectRatio: 1.0,
        };

        const onScanSuccess = (decodedText: string) => {
          console.log("QR Code detectado:", decodedText);

          // Validar se é uma URL ou slug válido
          if (decodedText && decodedText.trim().length > 0) {
            // Parar scanner antes de processar
            html5QrCode
              .stop()
              .then(() => {
                onQRCodeDetected(decodedText);
              })
              .catch((err) => {
                console.error("Erro ao parar scanner:", err);
                onQRCodeDetected(decodedText);
              });
          } else {
            setError("QR Code inválido. Tente novamente.");
          }
        };

        const onScanError = () => {
          // Silenciar erros de scanner
        };

        // Iniciar câmera
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          onScanError,
        );

        setScannerReady(true);
        setError("");
        console.log("Scanner iniciado com sucesso");
      } catch (err) {
        console.error("Erro ao iniciar scanner:", err);
        if (err instanceof Error) {
          setError("Erro ao iniciar o scanner: " + err.message);
        } else {
          setError("Erro ao iniciar o scanner. Tente novamente.");
        }
        isScanning.current = false;
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerReady) {
        scannerRef.current.stop().catch((err) => {
          console.error("Erro ao parar scanner:", err);
        });
      }
    };
  }, [onQRCodeDetected, permissionGranted, permissionChecked, scannerReady]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          console.log("Câmera desabilitada");
          onClose();
        })
        .catch((err) => {
          console.error("Erro ao desabilitar câmera:", err);
          onClose();
        });
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      {/* Botão fechar no topo */}
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={handleClose}
          className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-lg"
        >
          <X className="w-6 h-6 text-black" />
        </button>
      </div>

      {/* Se ainda não verificou a permissão */}
      {!permissionChecked && (
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-white text-center text-lg font-semibold">
            Solicitando acesso à câmera...
          </p>
        </div>
      )}

      {/* Se permissão foi concedida, mostrar câmera */}
      {permissionGranted && permissionChecked && (
        <>
          {/* Container centralizado */}
          <div className="flex flex-col items-center justify-center gap-6">
            {/* Quadrado com câmera dentro */}
            <div className="relative w-80 h-80 bg-black rounded-lg overflow-hidden shadow-2xl border-4 border-white">
              {/* Container da câmera */}
              <div id="qr-reader" className="w-full h-full" />

              {/* Indicador de carregamento do scanner */}
              {!scannerReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                  <p className="text-white text-center font-semibold">
                    Inicializando câmera...
                  </p>
                </div>
              )}
            </div>

            {/* Texto informativo */}
            {scannerReady && (
              <p className="text-white text-center text-lg font-semibold bg-black bg-opacity-60 px-6 py-3 rounded-lg max-w-md">
                Aponte a câmera para o QR code da mesa
              </p>
            )}
          </div>
        </>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-3 rounded-lg max-w-sm text-center shadow-lg z-20 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Se permissão foi negada */}
      {!permissionGranted && permissionChecked && (
        <div className="flex flex-col items-center justify-center gap-4 px-6 max-w-md">
          <div className="text-6xl">📷</div>
          <p className="text-white text-center text-lg font-semibold">
            Permissão de Câmera Negada
          </p>
          <p className="text-gray-300 text-center text-sm">
            {error ||
              "Você negou o acesso à câmera. Para usar o leitor de QR code, você precisa permitir o acesso."}
          </p>
          <button
            onClick={handleClose}
            className="mt-4 px-6 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
