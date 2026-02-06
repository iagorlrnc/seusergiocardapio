import { useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../lib/supabase"
import { toast } from "react-toastify"
import { adminRegistrationSchema } from "../lib/validationSchemas"
interface AdminLoginProps {
  onSwitchToLogin: () => void
  onSwitchToEmployee: () => void
}

type UserType = "admin" | "employee"

const API_BASE = import.meta.env.VITE_API_URL || ""

export default function AdminLogin({
  onSwitchToLogin,
  onSwitchToEmployee,
}: AdminLoginProps) {
  const [showRegister, setShowRegister] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  // Register state
  const [userType, setUserType] = useState<UserType>("admin")
  const [regUsername, setRegUsername] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirmPassword, setRegConfirmPassword] = useState("")
  const [regError, setRegError] = useState("")
  const [regLoading, setRegLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const success = await login(username, password)

    if (!success) {
      setError("Usuário ou senha incorretos.")
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError("")

    try {
      // Validar com Zod
      const validationResult = adminRegistrationSchema.safeParse({
        username: regUsername,
        phone: regPhone,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        userType: userType,
      })

      if (!validationResult.success) {
        const firstIssue = validationResult.error.issues?.[0]
        const message = firstIssue?.message || "Dados inválidos."
        setRegError(message)
        return
      }

      setRegLoading(true)

      // Verificar se o nome de usuário já existe
      const { data: existingUser } = await supabase
        .from("users")
        .select("username")
        .eq("username", regUsername)
        .maybeSingle()

      if (existingUser) {
        setRegError(
          "Este nome de usuário já está em uso. Escolha outro e tente novamente.",
        )
        setRegLoading(false)
        return
      }

      const response = await fetch(
        `${API_BASE}/api/auth/request-registration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: regUsername,
            phone: regPhone,
            password: regPassword,
            userType,
          }),
        },
      )

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setRegError(
          result?.error ||
            "Não foi possível enviar a solicitação. Tente novamente.",
        )
        setRegLoading(false)
        return
      }

      toast.success(
        "Solicitação enviada! Seu cadastro ficará pendente até a aprovação do administrador.",
      )

      // Limpar formulário e voltar para login
      setRegUsername("")
      setRegPhone("")
      setRegPassword("")
      setRegConfirmPassword("")
      setUserType("admin")
      setShowRegister(false)
    } catch (error) {
      setRegError(
        "Não foi possível enviar sua solicitação agora. Tente novamente em instantes.",
      )
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[url('/assets/bg.jpg')] bg-cover bg-center flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-black/20 backdrop-blur-sm rounded-lg shadow-2xl p-8 before:absolute before:inset-0 before:rounded-lg before:z-0">
          {!showRegister ? (
            <>
              <div className="relative z-10 mb-0 flex flex-col items-center">
                <img
                  src="/assets/iconwhite.png"
                  className="w-24 h-24 object-cover rounded-full mb-1"
                />
                {/* <img
                  src="/assets/loginadminwhite.png"
                  className="w-[180px] object-contain mb-2"
                /> */}
                <h1
                  className="text-[#c7e7e8] text-center text-4xl mb-6"
                  style={{
                    fontFamily: "'Verona TS Bold', serif",
                    textShadow: "0 2px 6px rgba(0,0,0)",
                  }}
                >
                  Login
                  <br />
                  Administrador
                </h1>
              </div>

              <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Nome de Usuário
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                {error && (
                  <div className="relative z-10 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="relative z-10 w-full bg-[#f8a808] text-black py-3 rounded-lg font-semibold hover:bg-[#ffd814] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <div className="relative z-10 mt-6 space-y-3">
                <button
                  onClick={() => setShowRegister(true)}
                  className="w-full text-sm text-white bg-[#013d5a] hover:bg-[#0084c4] px-4 py-2 rounded-lg transition font-semibold"
                >
                  Cadastro
                </button>

                <div className="text-center space-y-3">
                  <button
                    onClick={onSwitchToEmployee}
                    className="block w-full text-sm text-white active:text-white focus:text-white transition-colors"
                  >
                    Acesso Funcionário{" "}
                    <span className="font-semibold">Login Funcionário</span>
                  </button>

                  <button
                    onClick={onSwitchToLogin}
                    className="text-sm text-white active:text-white focus:text-white transition-colors"
                  >
                    Voltar ao <span className="font-semibold">Login</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative z-10 flex justify-center mb-6">
                {/* <img
                  src="/assets/cadastroadminwhite.png"
                  alt="Cadastro"
                  className="w-32 object-contain"
                /> */}
                <h1
                  className="text-[#c7e7e8] text-center text-4xl"
                  style={{
                    fontFamily: "'Verona TS Bold', serif",
                    textShadow: "0 2px 6px rgba(0,0,0)",
                  }}
                >
                  Cadastro de Administrador
                </h1>
              </div>
              <form
                onSubmit={handleRegisterSubmit}
                className="relative z-10 space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Tipo de Usuário
                  </label>
                  <select
                    value={userType}
                    onChange={(e) => {
                      setUserType(e.target.value as UserType)
                      setRegUsername("")
                      setRegPhone("")
                      setRegPassword("")
                      setRegConfirmPassword("")
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition bg-white"
                  >
                    <option value="admin">Administrador</option>
                    <option value="employee">Funcionário</option>
                  </select>
                </div>

                <>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      Nome de Usuário
                    </label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "")
                        setRegPhone(value)
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      Senha
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                    <p className="text-xs text-white mt-1">
                      Mínimo 8 caracteres, com letra maiúscula e caractere
                      especial (!@#$%^&* etc.)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      Confirmar Senha
                    </label>
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                </>

                {regError && (
                  <div className="relative z-10 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                    {regError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="relative z-10 w-full bg-[#f8a808] text-black py-3 rounded-lg font-semibold hover:bg-[#ffd814] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regLoading
                    ? "Enviando solicitação..."
                    : "Solicitar ao Administrador"}
                </button>
              </form>
              <div className="relative z-10 mt-6 text-center">
                <button
                  onClick={() => setShowRegister(false)}
                  className="text-sm text-white active:text-white transition-colors font-semibold"
                >
                  Voltar ao <span className="font-semibold">Login</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
