import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  LogOut,
  ChevronDown,
  Trash2,
  Lock,
  Unlock,
  Bell,
  X,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { supabase, Order } from "../lib/supabase"
import { toast } from "react-toastify"

const formatOrderNumericId = (id: string) => {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000
  }
  if (hash < 100) hash += 100
  return String(hash).padStart(3, "0")
}

const getPaymentMethodLabel = (paymentMethod: string) => {
  switch (paymentMethod) {
    case "pix":
      return "PIX"
    case "dinheiro":
      return "Dinheiro"
    case "cartao_credito":
      return "Cartão de Crédito"
    case "cartao_debito":
      return "Cartão de Débito"
    default:
      return paymentMethod
  }
}

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<
    "orders" | "tables" | "notifications"
  >("orders")
  const [allUsers, setAllUsers] = useState<
    Array<{ id: string; username: string }>
  >([])
  const [sessionUsers, setSessionUsers] = useState<Set<string>>(new Set())
  const [waiterCalls, setWaiterCalls] = useState<
    Array<{
      id: string
      user_id: string
      table_name: string
      status: string
      created_at: string
    }>
  >([])

  const fetchOrders = async () => {
    try {
      // Primeiro busca os pedidos básicos
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("hidden", false)
        .order("created_at", { ascending: false })

      if (ordersError) {
        setOrders([])
        setLoading(false)
        return
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([])
        setLoading(false)
        return
      }

      // Busca os usuários
      const { data: usersData } = await supabase
        .from("users")
        .select("id, username")

      // Busca os itens de cada pedido
      const orderIds = ordersData.map((o) => o.id)
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*, menu_items(*)")
        .in("order_id", orderIds)

      // Monta os dados completos
      const completeOrders = ordersData.map((order) => {
        const user = usersData?.find((u) => u.id === order.user_id)
        const assignedEmployee = usersData?.find(
          (u) => u.id === order.assigned_to,
        )
        const items =
          itemsData?.filter((item) => item.order_id === order.id) || []
        return {
          ...order,
          users: user ? { username: user.username } : { username: "Cliente" },
          assignedEmployee: assignedEmployee
            ? { username: assignedEmployee.username }
            : null,
          order_items: items,
        }
      })

      setOrders(completeOrders as any[])
      setLoading(false)
    } catch (error) {
      setOrders([])
      setLoading(false)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const { data } = await supabase
        .from("users")
        .select("id, username")
        .eq("is_admin", false)
        .eq("is_employee", false)
        .order("username")
      setAllUsers(data || [])
    } catch (error) {
      // Silent fail
    }
  }

  const fetchWaiterCalls = async () => {
    try {
      const { data } = await supabase
        .from("waiter_calls")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
      setWaiterCalls(data || [])
    } catch (error) {
      toast.error("Erro ao buscar chamadas")
    }
  }

  const markCallAsCompleted = async (callId: string) => {
    try {
      const { error } = await supabase
        .from("waiter_calls")
        .update({ status: "completed" })
        .eq("id", callId)

      if (error) throw error

      fetchWaiterCalls()
    } catch (error) {
      toast.error("Erro ao marcar chamada como concluída")
    }
  }

  const loadSessionUsers = async () => {
    try {
      const { data } = await supabase.from("active_sessions").select("username")
      const usernames = new Set(data?.map((s: any) => s.username) || [])
      setSessionUsers(usernames)
    } catch (error) {
      // Silent fail
    }
  }

  const reserveTable = async (username: string) => {
    try {
      const user = allUsers.find((u) => u.username === username)
      if (!user) return

      const { error } = await supabase.from("active_sessions").upsert(
        {
          user_id: user.id,
          username: user.username,
        },
        { onConflict: "user_id" },
      )

      if (error) {
        toast.error("Erro ao reservar mesa: " + error.message)
        return
      }

      toast.success(`Mesa ${username} reservada!`)
      loadSessionUsers()
    } catch (error) {
      toast.error("Erro ao reservar mesa")
    }
  }

  const releaseTable = async (username: string) => {
    try {
      const user = allUsers.find((u) => u.username === username)
      if (!user) return

      const { error } = await supabase
        .from("active_sessions")
        .delete()
        .eq("user_id", user.id)

      if (error) {
        toast.error("Erro ao liberar mesa: " + error.message)
        return
      }

      toast.success(`Mesa ${username} liberada!`)
      loadSessionUsers()
    } catch (error) {
      toast.error("Erro ao liberar mesa")
    }
  }

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("active", true)

    if (data) {
      // Not needed anymore, but keeping for compatibility
    }
  }

  useEffect(() => {
    fetchMenuItems()
    fetchOrders()
    fetchAllUsers()
    loadSessionUsers()
    fetchWaiterCalls()

    const interval = setInterval(() => {
      fetchOrders()
      loadSessionUsers()
      fetchWaiterCalls()
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      // Se o status é "preparing" ou "cancelled", marcar que esse funcionário aceitou/cancelou o pedido
      const updateData: any = { status: newStatus }

      if (
        (newStatus === "preparing" || newStatus === "cancelled") &&
        user?.id
      ) {
        // Verificar se o funcionário existe no banco antes de salvar
        const { data: employeeExists } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single()

        if (employeeExists) {
          updateData.assigned_to = user.id
        } else {
          toast.warn(
            "Aviso: Não foi possível atribuir o pedido a você. Por favor, faça login novamente.",
          )
        }
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)

      if (error) {
        toast.error("Erro ao atualizar pedido: " + error.message)
        return
      }

      // Mensagens de feedback baseadas no status
      const statusMessages: Record<string, string> = {
        preparing: "Pedido aceito! Você começou a preparar.",
        ready: "Pedido pronto para entrega!",
        completed: "Pedido finalizado!",
        cancelled: "Pedido cancelado.",
      }

      const message = statusMessages[newStatus] || "Pedido atualizado!"
      toast.success(message)

      fetchOrders()
    } catch (error) {
      toast.error("Erro ao atualizar pedido. Tente novamente.")
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Tem certeza que deseja remover este pedido?")) {
      return
    }
    await supabase.from("orders").update({ hidden: true }).eq("id", orderId)
    toast.error("Pedido removido da lista!")
    fetchOrders()
  }

  const handleClearAllOrders = async (username: string) => {
    if (
      !confirm(`Deseja realmente limpar todos os pedidos da Mesa ${username}?`)
    ) {
      return
    }

    try {
      // Pegar todos os IDs dos pedidos dessa mesa
      const orderIds = orders
        .filter((order) => order.users?.username === username)
        .map((order) => order.id)

      // Ocultar todos os pedidos dessa mesa
      const { error } = await supabase
        .from("orders")
        .update({ hidden: true })
        .in("id", orderIds)

      if (error) {
        toast.error("Erro ao limpar pedidos: " + error.message)
        return
      }

      toast.success(`Todos os pedidos da Mesa ${username} foram removidos!`)
      fetchOrders()
    } catch (error) {
      toast.error("Erro ao limpar pedidos")
    }
  }

  const toggleUserAccordion = (username: string) => {
    const newSet = new Set(expandedUsers)
    if (newSet.has(username)) {
      newSet.delete(username)
    } else {
      newSet.add(username)
    }
    setExpandedUsers(newSet)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Carregando pedidos...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md border-b sticky top-0 z-40">
        <div className="w-full pt-4 px-3 sm:px-4 md:px-6">
          <div className="flex items-center justify-between py-3 sm:py-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
                Painel de Pedidos
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {user?.username}
              </p>
            </div>
            <button
              onClick={() => {
                logout()
                navigate("/")
              }}
              className="p-2 sm:p-2.5 md:p-3 hover:bg-gray-100 rounded-lg transition duration-200"
              title="Sair"
            >
              <LogOut className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
            </button>
          </div>
          <div className="flex gap-0 border-t relative">
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 font-semibold text-base sm:text-lg md:text-xl transition duration-200 flex items-center justify-center gap-2 relative ${
                activeTab === "orders"
                  ? "border-b-2 border-black text-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Pedidos
              {orders.filter((o) => o.status === "pending").length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
                  {orders.filter((o) => o.status === "pending").length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("tables")}
              className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 font-semibold text-base sm:text-lg md:text-xl transition duration-200 ${
                activeTab === "tables"
                  ? "border-b-2 border-black text-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Mesas
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 font-semibold text-base sm:text-lg md:text-xl transition duration-200 flex items-center justify-center gap-2 relative ${
                activeTab === "notifications"
                  ? "border-b-2 border-black text-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
              {waiterCalls.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
                  {waiterCalls.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto">
        {activeTab === "orders" ? (
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-black">
              Pedidos
            </h2>
            <div className="space-y-3 sm:space-y-4">
              {(() => {
                const ordersByUser = orders
                  .filter((order) => !order.hidden)
                  .reduce(
                    (acc, order) => {
                      const username = order.users?.username || "Cliente"
                      if (!acc[username]) acc[username] = []
                      acc[username].push(order)
                      return acc
                    },
                    {} as Record<string, typeof orders>,
                  )

                return Object.keys(ordersByUser).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Não há pedidos no momento
                  </p>
                ) : (
                  Object.entries(ordersByUser).map(([username, userOrders]) => (
                    <div
                      key={username}
                      className="border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <button
                        onClick={() => toggleUserAccordion(username)}
                        className="w-full text-left p-3 sm:p-4 font-bold text-base sm:text-lg text-black hover:bg-gray-50 transition flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="whitespace-nowrap">
                            Pedidos da Mesa {username}
                          </span>
                          {userOrders.some((o) => o.status === "pending") && (
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                              Novo
                            </span>
                          )}
                          {userOrders.every(
                            (o) => o.status === "cancelled",
                          ) && (
                            <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                              Cancelado
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform flex-shrink-0 ml-2`}
                          style={{
                            transform: expandedUsers.has(username)
                              ? "rotate(180deg)"
                              : "rotate(0)",
                          }}
                        />
                      </button>
                      {expandedUsers.has(username) && (
                        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 border-t bg-gray-50">
                          {userOrders.map((order) => (
                            <div
                              key={order.id}
                              className="border rounded-lg p-3 sm:p-4 bg-white hover:shadow-md transition-shadow"
                            >
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                                    <h3 className="font-bold text-base sm:text-lg text-black break-words">
                                      Mesa {order.users?.username || "Cliente"}
                                    </h3>
                                    {order.assigned_to &&
                                      order.assignedEmployee && (
                                        <span className="bg-blue-100 text-blue-800 text-xs px-2 sm:px-3 py-1 rounded-full font-semibold whitespace-nowrap">
                                          Atendido por:{" "}
                                          {order.assignedEmployee.username}
                                        </span>
                                      )}
                                  </div>
                                  <p className="text-xs sm:text-sm text-gray-600">
                                    Pedido #{formatOrderNumericId(order.id)}
                                  </p>
                                  <p className="text-xs sm:text-sm text-gray-600">
                                    {new Date(order.created_at).toLocaleString(
                                      "pt-BR",
                                    )}
                                  </p>
                                </div>
                                <div className="text-left sm:text-left w-full sm:w-auto">
                                  <p className="text-xs sm:text-sm text-gray-600 mb-1">
                                    Total
                                  </p>
                                  <p className="text-xl sm:text-2xl font-bold text-black">
                                    R$ {order.total.toFixed(2)}
                                  </p>
                                  {order.status === "pending" && (
                                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "preparing",
                                          )
                                        }
                                        className="px-3 sm:px-4 py-2 bg-black text-white rounded-lg text-xs sm:text-sm hover:bg-gray-800 transition font-semibold flex-1"
                                      >
                                        Aceitar
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              "Tem certeza que deseja cancelar este pedido?",
                                            )
                                          ) {
                                            updateOrderStatus(
                                              order.id,
                                              "cancelled",
                                            )
                                          }
                                        }}
                                        className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg text-xs sm:text-sm hover:bg-red-600 transition font-semibold flex-1"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                  {order.status === "preparing" && (
                                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(order.id, "ready")
                                        }
                                        className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm hover:bg-blue-600 transition font-semibold flex-1"
                                      >
                                        Pronto
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              "Tem certeza que deseja cancelar este pedido?",
                                            )
                                          ) {
                                            updateOrderStatus(
                                              order.id,
                                              "cancelled",
                                            )
                                          }
                                        }}
                                        className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg text-xs sm:text-sm hover:bg-red-600 transition font-semibold flex-1"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                  {order.status === "ready" && (
                                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "completed",
                                          )
                                        }
                                        className="px-3 sm:px-4 py-2 bg-green-500 text-white rounded-lg text-xs sm:text-sm hover:bg-green-600 transition font-semibold flex-1"
                                      >
                                        Finalizar
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              "Tem certeza que deseja cancelar este pedido?",
                                            )
                                          ) {
                                            updateOrderStatus(
                                              order.id,
                                              "cancelled",
                                            )
                                          }
                                        }}
                                        className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg text-xs sm:text-sm hover:bg-red-600 transition font-semibold flex-1"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                  {order.status === "completed" && (
                                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                                      <span className="px-3 sm:px-4 py-2 bg-gray-500 text-white rounded-lg text-xs sm:text-sm font-semibold">
                                        Finalizado
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleDeleteOrder(order.id)
                                        }
                                        className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition flex items-center justify-center"
                                        title="Ocultar pedido"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                  {order.status === "cancelled" && (
                                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                                      <span className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg text-xs sm:text-sm font-semibold">
                                        Cancelado
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleDeleteOrder(order.id)
                                        }
                                        className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition flex items-center justify-center"
                                        title="Ocultar pedido"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                {order.order_items?.map((item) => (
                                  <div
                                    key={item.id}
                                    className="text-xs sm:text-sm text-gray-700 border-b pb-2 last:border-b-0"
                                  >
                                    <div className="flex justify-between">
                                      <span className="flex-1">
                                        {item.quantity}x {item.menu_items?.name}
                                      </span>
                                      <span className="font-semibold ml-2 flex-shrink-0">
                                        R${" "}
                                        {(item.price * item.quantity).toFixed(
                                          2,
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Informações adicionais do pedido */}
                              {(order.payment_method || order.observations) && (
                                <div className="mt-4 space-y-2">
                                  {order.payment_method && (
                                    <div className="p-2 sm:p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                                      <p className="text-xs sm:text-sm text-gray-700">
                                        <strong className="text-gray-900">
                                          Pagamento:
                                        </strong>{" "}
                                        {getPaymentMethodLabel(
                                          order.payment_method,
                                        )}
                                      </p>
                                    </div>
                                  )}
                                  {order.observations && (
                                    <div className="p-2 sm:p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                                      <p className="text-xs sm:text-sm text-gray-700 break-words">
                                        <strong className="text-gray-900">
                                          Observação:
                                        </strong>{" "}
                                        {order.observations}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Total e botão de limpar tudo - apenas se todos os pedidos estiverem finalizados ou cancelados */}
                          {userOrders.every(
                            (o) =>
                              o.status === "completed" ||
                              o.status === "cancelled",
                          ) && (
                            <div className="mt-4 pt-4 border-t-2 border-gray-300 flex flex-col sm:flex-row items-center justify-between gap-3">
                              <div className="text-left">
                                <p className="text-sm text-gray-600 mb-1">
                                  Total Geral da Mesa
                                </p>
                                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                                  R${" "}
                                  {userOrders
                                    .reduce(
                                      (sum, order) => sum + order.total,
                                      0,
                                    )
                                    .toFixed(2)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleClearAllOrders(username)}
                                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition flex items-center justify-center gap-2"
                              >
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                Limpar Tudo
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )
              })()}
            </div>
          </div>
        ) : activeTab === "tables" ? (
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-black">Mesas</h2>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {allUsers.map((user) => {
                const isActive = sessionUsers.has(user.username)
                return (
                  <div
                    key={user.id}
                    className={`border rounded-lg p-4 sm:p-5 transition-all ${
                      isActive
                        ? "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300 shadow-sm hover:shadow-md"
                        : "bg-gradient-to-br from-green-50 to-green-100 border-green-300 shadow-sm hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-col h-full">
                      <div className="mb-4">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 break-words">
                          Mesa {user.username}
                        </h3>
                        <div
                          className={`inline-flex px-3 py-1 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap ${
                            isActive
                              ? "bg-orange-500 text-white"
                              : "bg-green-500 text-white"
                          }`}
                        >
                          {isActive ? "🔴 Em uso" : "🟢 Disponível"}
                        </div>
                      </div>
                      {isActive ? (
                        <button
                          onClick={() => releaseTable(user.username)}
                          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 mt-auto active:scale-95"
                        >
                          <Unlock className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="text-sm sm:text-base">Liberar</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => reserveTable(user.username)}
                          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 mt-auto active:scale-95"
                        >
                          <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="text-sm sm:text-base">Reservar</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {allUsers.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                Nenhuma mesa disponível
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-black flex items-center gap-2">
              <Bell className="w-6 h-6 sm:w-7 sm:h-7" />
              Notificações
            </h2>
            {waiterCalls.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-base sm:text-lg">
                  Nenhuma chamada de garçom no momento
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {waiterCalls.map((call) => (
                  <div
                    key={call.id}
                    className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-lg p-4 sm:p-5 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-red-900 mb-1">
                          Mesa {call.table_name}
                        </h3>
                        <p className="text-xs sm:text-sm text-red-700">
                          {new Date(call.created_at).toLocaleTimeString(
                            "pt-BR",
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 animate-bounce" />
                      </div>
                    </div>
                    <p className="text-sm sm:text-base text-red-800 mb-4 font-semibold">
                      Está solicitando presença na mesa.
                    </p>
                    <button
                      onClick={() => markCallAsCompleted(call.id)}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                      Atendida
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
