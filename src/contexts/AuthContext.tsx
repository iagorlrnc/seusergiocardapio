import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"
import { supabase, User } from "../lib/supabase"

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (
    username: string,
    password?: string,
    isEmployee?: boolean,
    isQRLogin?: boolean,
  ) => Promise<boolean>
  loginBySlug: (slug: string, isQRLogin?: boolean) => Promise<boolean>
  register: (
    username: string,
    phone: string,
    password: string,
    adminUsername: string,
    adminPassword: string,
  ) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE = import.meta.env.VITE_API_URL || ""

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [logoutTimer, setLogoutTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem("allblack_user")
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser) as Partial<User>
      const normalizedUser: User = {
        id: parsedUser.id || "",
        username: parsedUser.username || "",
        phone: parsedUser.phone || "",
        is_admin: !!parsedUser.is_admin,
        is_employee: !!parsedUser.is_employee,
        slug: parsedUser.slug || "",
      }
      setUser(normalizedUser)
      // Se é um cliente (customer), inicia o timer de auto-logout
      if (!normalizedUser.is_admin && !normalizedUser.is_employee) {
        startAutoLogoutTimer()
      }
    }
    setLoading(false)
  }, [])

  const persistUser = (userData: User) => {
    const persisted = {
      id: userData.id,
      username: userData.username,
      is_admin: userData.is_admin,
      is_employee: userData.is_employee,
      slug: userData.slug,
      phone: "",
    }
    localStorage.setItem("allblack_user", JSON.stringify(persisted))
  }

  const startAutoLogoutTimer = () => {
    // Limpar timer anterior se existir
    if (logoutTimer) {
      clearTimeout(logoutTimer)
    }
    // Inicia novo timer para 10 minutos (600000ms)
    const timer = setTimeout(() => {
      logout()
    }, 600000) // 10 minutos
    setLogoutTimer(timer)
  }

  const login = async (
    username: string,
    password?: string,
    isEmployee: boolean = false,
    isQRLogin: boolean = false,
  ): Promise<boolean> => {
    try {
      if (isEmployee || password) {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password: password || "",
            isEmployee,
          }),
        })

        if (!response.ok) {
          return false
        }

        const result = (await response.json()) as {
          success?: boolean
          user?: User
        }

        if (!result?.success || !result.user) {
          return false
        }

        const userData: User = result.user

        // Registrar sessão ativa
        try {
          const { error: sessionError } = await supabase
            .from("active_sessions")
            .upsert(
              {
                user_id: userData.id,
                username: userData.username,
                login_at: new Date().toISOString(),
                last_activity: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            )
          if (sessionError) {
            console.error("Erro ao registrar sessão:", sessionError)
          } else {
            console.log(
              `Sessão registrada para: ${userData.username}${isQRLogin ? " (via QR Code)" : ""}`,
            )
          }
        } catch (sessionError) {
          console.error("Erro ao registrar sessão:", sessionError)
        }

        setUser(userData)
        persistUser(userData)

        if (!userData.is_admin && !userData.is_employee) {
          startAutoLogoutTimer()
        }

        return true
      }

      let query = supabase
        .from("users")
        .select("id, username, phone, is_admin, is_employee, slug")
        .eq("username", username)
        .eq("is_admin", false)
        .eq("is_employee", false)

      const { data, error } = await query.maybeSingle()

      if (error || !data) {
        return false
      }

      const userData: User = {
        id: data.id,
        username: data.username,
        phone: data.phone,
        is_admin: data.is_admin,
        is_employee: data.is_employee,
        slug: data.slug,
      }

      // Registrar sessão ativa
      try {
        const { error: sessionError } = await supabase
          .from("active_sessions")
          .upsert(
            {
              user_id: data.id,
              username: data.username,
              login_at: new Date().toISOString(),
              last_activity: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )
        if (sessionError) {
          console.error("Erro ao registrar sessão:", sessionError)
        } else {
          console.log(
            `Sessão registrada para: ${data.username}${isQRLogin ? " (via QR Code)" : ""}`,
          )
        }
      } catch (sessionError) {
        console.error("Erro ao registrar sessão:", sessionError)
      }

      setUser(userData)
      persistUser(userData)

      // Se é um cliente (customer), inicia o timer de auto-logout
      if (!userData.is_admin && !userData.is_employee) {
        startAutoLogoutTimer()
      }

      return true
    } catch (error) {
      return false
    }
  }

  const loginBySlug = async (
    slug: string,
    isQRLogin: boolean = true,
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, username, phone, is_admin, is_employee, slug")
        .eq("slug", slug)
        .eq("is_admin", false)
        .eq("is_employee", false)
        .maybeSingle()

      if (error || !data) {
        return false
      }

      const userData: User = {
        id: data.id,
        username: data.username,
        phone: data.phone,
        is_admin: data.is_admin,
        is_employee: data.is_employee,
        slug: data.slug,
      }

      try {
        const { error: sessionError } = await supabase
          .from("active_sessions")
          .upsert(
            {
              user_id: data.id,
              username: data.username,
              login_at: new Date().toISOString(),
              last_activity: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )
        if (sessionError) {
          console.error("Erro ao registrar sessão:", sessionError)
        } else {
          console.log(
            `Sessão registrada para: ${data.username}${isQRLogin ? " (via QR Code)" : ""}`,
          )
        }
      } catch (sessionError) {
        console.error("Erro ao registrar sessão:", sessionError)
      }

      setUser(userData)
      persistUser(userData)

      // Se é um cliente (customer), inicia o timer de auto-logout
      if (!userData.is_admin && !userData.is_employee) {
        startAutoLogoutTimer()
      }

      return true
    } catch (error) {
      return false
    }
  }

  const register = async (
    username: string,
    phone: string,
    password: string,
    adminUsername: string,
    adminPassword: string,
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          phone,
          password,
          adminUsername,
          adminPassword,
        }),
      })

      if (!response.ok) {
        return false
      }

      const result = (await response.json()) as { success?: boolean }
      return !!result?.success
    } catch (error) {
      return false
    }
  }

  const logout = () => {
    // Limpar timer de auto-logout
    if (logoutTimer) {
      clearTimeout(logoutTimer)
      setLogoutTimer(null)
    }
    // Limpar flag de boas-vindas para que apareça novamente no próximo login
    if (user?.id) {
      localStorage.removeItem(`welcome_shown_${user.id}`)
    }
    // A sessão ativa NÃO é removida no logout do cliente
    // A mesa permanece marcada como "em uso" até que o funcionário a libere explicitamente
    setUser(null)
    localStorage.removeItem("allblack_user")
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginBySlug, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
