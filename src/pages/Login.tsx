import { useState, useEffect } from "react"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../lib/supabase"
import { QRCodeReader } from "../components/QRCodeReader"

interface LoginProps {
  onSwitchToRegister: () => void
  onSwitchToEmployee: () => void
}

interface ClientUser {
  id: string
  username: string
}

export default function Login({
  onSwitchToRegister,
  onSwitchToEmployee,
}: LoginProps) {
  const [username, setUsername] = useState("")
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [loggedInUsers, setLoggedInUsers] = useState<string[]>([])
  const [showQRReader, setShowQRReader] = useState(false)
  const { login, loginBySlug } = useAuth()

  useEffect(() => {
    const fetchClientUsers = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("users")
          .select("id, username")
          .eq("is_admin", false)
          .eq("is_employee", false)
          .order("username", { ascending: true })

        if (fetchError) throw fetchError
        setClientUsers(data || [])
      } catch (err) {
        // Silent fail
      }
    }

    // Carregar usuários logados da tabela active_sessions
    const loadLoggedInUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("active_sessions")
          .select("username")

        if (error) {
          throw error
        }
        const usernames = data?.map((session: any) => session.username) || []
        setLoggedInUsers(usernames)
      } catch (err) {
        // Silent fail
      }
    }

    fetchClientUsers()
    loadLoggedInUsers()

    // Atualizar a cada 5 segundos
    const interval = setInterval(loadLoggedInUsers, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const success = await login(username)

    if (!success) {
      setError("Usuário não encontrado")
      setLoading(false)
    }
  }

  const handleQRCodeDetected = async (data: string) => {
    try {
      // Extrair a slug da URL do QR code
      // Formato esperado: https://domain.com/mesa-123-uuid ou /mesa-123-uuid
      const urlParts = data.split("/")
      const slug = urlParts[urlParts.length - 1]

      if (slug) {
        setShowQRReader(false)
        setError("")
        setLoading(true)

        // Fazer login automático via slug
        const success = await loginBySlug(slug, true)

        if (!success) {
          setError("QR Code inválido ou mesa não encontrada")
          setLoading(false)
        }
      } else {
        setError("QR Code inválido")
      }
    } catch (err) {
      setError("Erro ao processar QR code")
    }
  }

  //bg-[url('/assets/.jpg')]

  return (
    <div className="min-h-screen bg-[url('/assets/bg.jpg')] bg-cover bg-center flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-black/20 backdrop-blur-sm rounded-lg shadow-2xl p-8 before:absolute before:inset-0 before:rounded-lg before:z-0">
          <div className="relative z-10 mb-0 flex flex-col items-center">
            <img
              src="/assets/iconwhite.png"
              className="w-24 h-24 object-cover rounded-full mb-1"
            />
            <h1
              className="text-[#c7e7e8] text-center text-4xl mb-6"
              style={{
                fontFamily: "'Verona TS Bold', serif",
                textShadow: "0 2px 6px rgba(0,0,0)",
              }}
            >
              Cardápio
            </h1>
          </div>
          {error && (
            <div className="relative z-10 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Selecione sua Mesa
              </label>
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-[#001b6b] rounded-lg focus:ring-2 focus:ring-[#001b6b] focus:border-transparent outline-none transition bg-white"
                required
              >
                <option value="">Selecionar</option>
                {clientUsers.map((user) => (
                  <option
                    key={user.id}
                    value={user.username}
                    disabled={loggedInUsers.includes(user.username)}
                  >
                    Mesa {user.username}
                    {loggedInUsers.includes(user.username) ? " (Ocupada)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowQRReader(true)}
              className="relative w-full bg-[#013d5a] text-white py-2 rounded-lg font-semibold hover:bg-[#0084c4] transition"
            >
              Ler QR Code
            </button>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full bg-[#f8a808] text-black py-3 rounded-lg font-semibold hover:bg-[#ffd814] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="relative z-10 mt-6 text-center">
            <button
              onClick={onSwitchToEmployee}
              className="block w-full text-sm text-white active:text-white focus:text-white transition mb-3"
            >
              Acesso Funcionário{" "}
              <span className="font-semibold">Login Funcionário</span>
            </button>

            <button
              onClick={onSwitchToRegister}
              className="text-sm text-white active:text-white focus:text-white transition"
            >
              Acesso Administrador{" "}
              <span className="font-semibold">Login Administrador</span>
            </button>
          </div>
        </div>
      </div>

      {showQRReader && (
        <QRCodeReader
          onQRCodeDetected={handleQRCodeDetected}
          onClose={() => setShowQRReader(false)}
        />
      )}
    </div>
  )
}
