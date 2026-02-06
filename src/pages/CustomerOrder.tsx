import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  ShoppingCart,
  LogOut,
  Plus,
  Minus,
  Trash2,
  X,
  Search,
  Clock,
  CheckCircle,
  ChefHat,
  Utensils,
  History,
  BookOpenCheck,
  Filter,
  ChevronDown,
  Share2,
  Bell,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { supabase, MenuItem, CartItem, Order } from "../lib/supabase"
import { UserQRCodeDisplay } from "../components/UserQRCodeDisplay"

const formatOrderNumericId = (id: string) => {
  // deterministic hash to 3-digit numeric id (100-999)
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000
  }
  if (hash < 100) hash += 100
  return String(hash).padStart(3, "0")
}

export default function CustomerOrder() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [cart, setCart] = useState<CartItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [userOrders, setUserOrders] = useState<Order[]>([])
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [toastMessage, setToastMessage] = useState<string>("")
  const [showToast, setShowToast] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu")
  const [showItemDetails, setShowItemDetails] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedItemQuantity, setSelectedItemQuantity] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [observations, setObservations] = useState<string>("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showWelcome, setShowWelcome] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [skipAutoSelectOrder, setSkipAutoSelectOrder] = useState(true)
  const [currentOrderItems, setCurrentOrderItems] = useState<any[]>([])
  const [showUserQRCode, setShowUserQRCode] = useState(false)
  const [callingWaiter, setCallingWaiter] = useState(false)
  const [lastWaiterCall, setLastWaiterCall] = useState<number | null>(null)
  const [itemQuantitySelector, setItemQuantitySelector] = useState<{
    [key: string]: number
  }>({})
  const toastTimeoutRef = useRef<number | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  const fetchMenuItems = useCallback(async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("active", true)
      .order("name")

    if (data) {
      setMenuItems(data)
      const allCategories = [...new Set(data.map((item) => item.category))]

      // Carregar ordem das categorias do banco de dados
      const { data: categoryOrderData } = await supabase
        .from("category_order")
        .select("category, position")
        .order("position", { ascending: true })

      if (categoryOrderData && categoryOrderData.length > 0) {
        // Usar ordem do banco de dados
        const orderedCats = categoryOrderData
          .map((item) => item.category)
          .filter((cat) => allCategories.includes(cat))

        // Adicionar categorias novas que não estão no banco
        const newCats = allCategories.filter(
          (cat) => !orderedCats.includes(cat),
        )
        setCategories(["todos", ...orderedCats, ...newCats])
      } else {
        // Sem ordem salva, usar ordem padrão
        setCategories(["todos", ...allCategories])
      }
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false)
      }
    }

    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isFilterOpen])

  const handleCategorySelect = (category: string) => {
    if (category === "Todos") {
      setSelectedCategories([])
    } else {
      setSelectedCategories((prev) => {
        const newSelection = prev.includes(category)
          ? prev.filter((c) => c !== category)
          : [...prev, category]

        // Verifica se todas as categorias (exceto "todos") foram selecionadas
        const allCategoriesExceptTodos = categories.filter(
          (cat) => cat !== "todos",
        )
        const allSelected = allCategoriesExceptTodos.every((cat) =>
          newSelection.includes(cat),
        )

        // Se todas foram selecionadas, marca como "Todos" (array vazia)
        return allSelected ? [] : newSelection
      })
    }
    setIsFilterOpen(false)
  }

  const removeCategory = (category: string) => {
    setSelectedCategories((prev) => prev.filter((c) => c !== category))
  }

  const checkExistingOrder = useCallback(async () => {
    if (!user?.id) return

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("hidden", false)
      .in("status", ["pending", "preparing", "ready", "completed", "cancelled"])
      .order("created_at", { ascending: false })

    if (data && data.length > 0) {
      // Buscar dados dos funcionários atribuídos
      const { data: usersData } = await supabase
        .from("users")
        .select("id, username")

      // Adicionar informações do funcionário a cada pedido
      const ordersWithEmployee = data.map((order) => {
        const assignedEmployee = usersData?.find(
          (u) => u.id === order.assigned_to,
        )
        return {
          ...order,
          assigned_employee: assignedEmployee
            ? { username: assignedEmployee.username }
            : null,
        }
      })

      setUserOrders(ordersWithEmployee)
      // Se há apenas um pedido e não estamos fazendo novo pedido, mantém sempre no painel de status
      if (ordersWithEmployee.length === 1 && !skipAutoSelectOrder) {
        setCurrentOrder(ordersWithEmployee[0])
        setViewingOrderId(ordersWithEmployee[0].id)
        setActiveTab("orders")
      } else if (isInitialLoad && !viewingOrderId && !skipAutoSelectOrder) {
        // Se há múltiplos pedidos e é a primeira carga, mostra o mais recente
        setCurrentOrder(ordersWithEmployee[0])
        setViewingOrderId(ordersWithEmployee[0].id)
        setActiveTab("orders")
        setIsInitialLoad(false)
      } else if (viewingOrderId) {
        // Se já está visualizando um pedido específico, mantém ele atualizado
        const viewingOrder = ordersWithEmployee.find(
          (order) => order.id === viewingOrderId,
        )
        if (viewingOrder) {
          setCurrentOrder(viewingOrder)
        }
      }
      // Quando há múltiplos pedidos e não é a primeira carga, não muda de aba
      if (ordersWithEmployee.length > 1) {
        setIsInitialLoad(false)
      }
    } else {
      setUserOrders([])
      setCurrentOrder(null)
      setViewingOrderId(null)
      setActiveTab("menu")
      setIsInitialLoad(false)
    }
  }, [user?.id, viewingOrderId, isInitialLoad, skipAutoSelectOrder])

  const fetchOrderStatus = useCallback(async () => {
    if (!currentOrder) return

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("id", currentOrder.id)
      .single()

    if (data && !data.hidden) {
      // Buscar dados do funcionário atribuído
      let assignedEmployee = null
      if (data.assigned_to) {
        const { data: userData } = await supabase
          .from("users")
          .select("id, username")
          .eq("id", data.assigned_to)
          .single()
        assignedEmployee = userData ? { username: userData.username } : null
      }

      // Buscar itens do pedido
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*, menu_items(*)")
        .eq("order_id", data.id)

      const orderWithEmployee = {
        ...data,
        assigned_employee: assignedEmployee,
      }

      setCurrentOrderItems(itemsData || [])
      setUserOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === data.id ? orderWithEmployee : order,
        ),
      )
      setCurrentOrder(orderWithEmployee)
    } else {
      // Pedido foi ocultado ou não existe mais, verificar se há outros pedidos
      checkExistingOrder()
    }
  }, [currentOrder, checkExistingOrder])

  useEffect(() => {
    // Verificar se deve mostrar tela de boas-vindas
    if (user?.id) {
      const welcomeShownKey = `welcome_shown_${user.id}`
      const hasShownWelcome = localStorage.getItem(welcomeShownKey)

      if (!hasShownWelcome) {
        setShowWelcome(true)
        localStorage.setItem(welcomeShownKey, "true")
      }
    }
  }, [user?.id])

  useEffect(() => {
    fetchMenuItems()
    checkExistingOrder()
  }, [checkExistingOrder, fetchMenuItems])

  useEffect(() => {
    const channel = supabase
      .channel("menu-items-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => {
          fetchMenuItems()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMenuItems])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMenuItems()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchMenuItems])

  useEffect(() => {
    if (currentOrder) {
      const interval = setInterval(() => {
        fetchOrderStatus()
      }, 5000) // Verificar status a cada 5 segundos

      return () => clearInterval(interval)
    }
  }, [currentOrder, fetchOrderStatus])

  useEffect(() => {
    if (activeTab === "orders") {
      const interval = setInterval(() => {
        checkExistingOrder()
      }, 3000) // Atualizar histórico de pedidos a cada 5 segundos

      return () => clearInterval(interval)
    }
  }, [activeTab, checkExistingOrder])

  useEffect(() => {
    if (viewingOrderId && activeTab === "orders") {
      const fetchOrderItems = async () => {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("*, menu_items(*)")
          .eq("order_id", viewingOrderId)

        setCurrentOrderItems(itemsData || [])
      }

      fetchOrderItems()
    }
  }, [viewingOrderId, activeTab])

  const addToCart = (item: MenuItem, quantity: number = 1) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === item.id)
      if (existingItem) {
        return prevCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem,
        )
      }
      return [...prevCart, { ...item, quantity }]
    })

    // Limpar o seletor de quantidade
    setItemQuantitySelector((prev) => {
      const newSelector = { ...prev }
      delete newSelector[item.id]
      return newSelector
    })

    // Mostrar toast de confirmação
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    setToastMessage(`${item.name} adicionado ao carrinho`)
    setShowToast(true)
    toastTimeoutRef.current = window.setTimeout(() => {
      setShowToast(false)
      toastTimeoutRef.current = null
    }, 2500)
  }

  const handleCartButtonClick = (itemId: string) => {
    setItemQuantitySelector((prev) => ({
      ...prev,
      [itemId]: 1,
    }))
  }

  const incrementQuantity = (itemId: string) => {
    setItemQuantitySelector((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 1) + 1,
    }))
  }

  const decrementQuantity = (itemId: string) => {
    setItemQuantitySelector((prev) => {
      const currentQty = prev[itemId] || 1
      if (currentQty > 1) {
        return {
          ...prev,
          [itemId]: currentQty - 1,
        }
      }
      // Se quantidade for 1 e decrementar, remover o seletor
      const newSelector = { ...prev }
      delete newSelector[itemId]
      return newSelector
    })
  }

  const confirmAddToCart = (item: MenuItem) => {
    const quantity = itemQuantitySelector[item.id] || 1
    addToCart(item, quantity)
  }

  const openItemDetails = (item: MenuItem) => {
    setSelectedItem(item)
    setSelectedItemQuantity(1)
    setShowItemDetails(true)
  }

  const cancelOrder = async (orderId: string) => {
    if (confirm("Deseja realmente cancelar este pedido?")) {
      try {
        await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", orderId)

        setToastMessage("Pedido cancelado com sucesso")
        setShowToast(true)
        toastTimeoutRef.current = window.setTimeout(() => {
          setShowToast(false)
          toastTimeoutRef.current = null
        }, 2500)

        // Atualizar o pedido localmente
        setCurrentOrder((prev) =>
          prev ? { ...prev, status: "cancelled" } : null,
        )
      } catch (error) {
        setToastMessage("Erro ao cancelar pedido")
        setShowToast(true)
        toastTimeoutRef.current = window.setTimeout(() => {
          setShowToast(false)
          toastTimeoutRef.current = null
        }, 2500)
      }
    }
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0)
    })
  }

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id))
  }

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  const handleNewOrder = () => {
    setCurrentOrder(null)
    setViewingOrderId(null)
    setSkipAutoSelectOrder(true)
    setActiveTab("menu")
  }

  const handleViewOrder = (order: Order) => {
    setCurrentOrder(order)
    setViewingOrderId(order.id)
    setActiveTab("orders")
  }

  const handleViewOrders = () => {
    setSkipAutoSelectOrder(false)
    setActiveTab("orders")
    // Se há apenas um pedido, seleciona ele automaticamente
    if (userOrders.length === 1) {
      setCurrentOrder(userOrders[0])
      setViewingOrderId(userOrders[0].id)
    } else if (userOrders.length > 0 && !currentOrder) {
      // Se há múltiplos e nenhum selecionado, seleciona o primeiro
      setCurrentOrder(userOrders[0])
      setViewingOrderId(userOrders[0].id)
    }
  }

  const handleCallWaiter = async () => {
    // Evitar chamadas repetidas em menos de 30 segundos
    if (lastWaiterCall && Date.now() - lastWaiterCall < 30000) {
      setToastMessage("Aguarde um pouco antes de chamar novamente.")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 2500)
      return
    }

    if (!user?.id) {
      setToastMessage("Erro: usuário não identificado.")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 2500)
      return
    }

    setCallingWaiter(true)

    try {
      // Primeiro, deletar chamadas pendentes antigas desta mesa
      await supabase
        .from("waiter_calls")
        .delete()
        .eq("user_id", user.id)
        .eq("status", "pending")

      // Inserir nova chamada
      const { error } = await supabase.from("waiter_calls").insert({
        user_id: user.id,
        table_name: user.username,
        status: "pending",
        created_at: new Date().toISOString(),
      })

      if (error) {
        throw error
      }

      setLastWaiterCall(Date.now())
      setToastMessage("Garçom solicitado! Aguarde a chegada.")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 2500)
    } catch (error) {
      setToastMessage("Erro ao solicitar garçom. Tente novamente.")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 2500)
    } finally {
      setCallingWaiter(false)
    }
  }

  const handleFinishOrder = async () => {
    // Verificações de validação
    if (!user?.id) {
      setToastMessage("Você precisa estar logado para fazer um pedido.")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 3000)
      return
    }

    if (cart.length === 0) {
      setToastMessage("Adicione pelo menos um item ao carrinho.")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 3000)
      return
    }

    if (!paymentMethod) {
      setToastMessage("Selecione a forma de pagamento.")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 3000)
      return
    }

    setLoading(true)

    try {
      const total = getTotal()

      // Preparar dados do pedido com todos os campos
      const basicOrderData = {
        user_id: user.id,
        status: "pending",
        total,
        payment_method: paymentMethod || null,
        observations: observations || null,
      }

      const { data: insertedOrder, error: orderError } = await supabase
        .from("orders")
        .insert(basicOrderData)
        .select()
        .single()

      if (orderError || !insertedOrder) {
        throw new Error(
          `Erro ao criar pedido: ${orderError?.message || "Erro desconhecido"}`,
        )
      }

      // Inserir os itens do pedido
      const orderItems = cart.map((item) => ({
        order_id: insertedOrder.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }))

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)

      if (itemsError) {
        throw new Error(
          `Erro ao adicionar itens ao pedido: ${itemsError.message}`,
        )
      }

      setToastMessage("Pedido realizado com sucesso!")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 3000)

      setCart([])
      setPaymentMethod("")
      setObservations("")

      // Adiciona o novo pedido à lista e define como atual
      setUserOrders((prevOrders) => [insertedOrder, ...prevOrders])
      setCurrentOrder(insertedOrder)
      setViewingOrderId(insertedOrder.id)
      setActiveTab("orders")
      setShowCart(false)
    } catch (error) {
      setToastMessage("Erro ao finalizar pedido. Tente novamente.")
      setShowToast(true)
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showWelcome && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-90 cursor-pointer select-none safe-area-top"
          onClick={() => setShowWelcome(false)}
        >
          <img
            src="/assets/iconpngorange.png"
            alt="Bem-vindo"
            className="w-32 sm:h-20 md:h-24 object-cover rounded-full"
          />
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 text-center break-words px-4"
            style={{ fontFamily: "'Verona TS Bold', serif" }}
          >
            Bem-vindo
          </h1>
          <p className="text-base sm:text-lg text-white mb-6 sm:mb-8 text-center px-4">
            Clique na tela para acessar o cardápio.
          </p>
        </div>
      )}
      {/* Fixed background layer */}
      <div
        className="fixed inset-0 bg-responsive -z-10"
        style={{
          backgroundImage: `url('/assets/bg.jpg')`,
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="fixed inset-0 bg-black/50 pointer-events-none" />
      <div
        className={`min-h-screen${showWelcome ? " pointer-events-none select-none blur-sm" : ""}`}
      >
        {/* Header */}
        <header className="sticky top-0 left-0 right-0 z-40 bg-black/20 backdrop-blur-sm shadow-md safe-area-top">
          <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-0">
              <div className="flex items-center gap-1 sm:gap-4">
                <button
                  onClick={() => setActiveTab("menu")}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition duration-200 ${
                    activeTab === "menu"
                      ? "bg-black text-white"
                      : "text-white hover:bg-white hover:text-black"
                  }`}
                >
                  <BookOpenCheck className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
                  <span className="hidden xs:inline text-current">
                    Cardápio
                  </span>
                </button>
                <button
                  onClick={handleViewOrders}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition duration-200 ${
                    activeTab === "orders"
                      ? "bg-black text-white"
                      : "text-white hover:bg-white hover:text-black"
                  }`}
                >
                  <History className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
                  <span className="hidden xs:inline text-current">Pedidos</span>
                </button>
              </div>

              <div className="hidden sm:flex flex-col items-center flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#fff]">
                  Cardápio
                </h1>
                <p className="text-xs sm:text-sm text-[#fff] mt-0.5">
                  Mesa <span className="font-semibold">{user?.username}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowUserQRCode(true)}
                  className="p-2 sm:p-2.5 md:p-3 hover:bg-gray-100 rounded-lg transition duration-200"
                  title="QR Code da Mesa"
                >
                  <Share2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white hover:text-black" />
                </button>
                <button
                  onClick={() => setShowCart(true)}
                  className="relative p-2 sm:p-2.5 md:p-3 hover:bg-gray-100 rounded-lg transition duration-200"
                >
                  <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white hover:text-black" />
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-bold">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    logout()
                    navigate("/")
                  }}
                  className="p-2 sm:p-2.5 md:p-3 hover:bg-gray-100 rounded-lg transition duration-200"
                  title="Sair"
                >
                  <LogOut className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white hover:text-black" />
                </button>
              </div>
            </div>

            {/* Mobile only title */}
            <div className="sm:hidden text-center mt-2">
              <h1 className="text-base font-bold text-white">Cardápio</h1>
              <p className="text-xs text-white mt-0.5">
                Mesa <span className="font-semibold">{user?.username}</span>
              </p>
            </div>
          </div>
        </header>

        <main className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3 pt-4 sm:pt-4 max-w-7xl mx-auto">
          {activeTab === "menu" ? (
            <div className="grid grid-cols-1 gap-0">
              {/* Call Waiter Button */}
              <div className="flex justify-center mb-2 sm:mb-4">
                <button
                  onClick={handleCallWaiter}
                  disabled={callingWaiter}
                  className="relative z-10 flex items-center gap-2 bg-gradient-to-r from-blue-800 to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-sm sm:text-base">
                    {callingWaiter ? "Chamando..." : "Solicitar Garçom"}
                  </span>
                </button>
              </div>

              {/* Menu Section */}
              <div>
                {/* Search and Filters */}
                <div
                  ref={filterRef}
                  className="relative z-50 bg-white/20 backdrop-blur-sm rounded-lg shadow-sm p-3 sm:p-4 md:p-6 mb-4 sm:mb-6"
                >
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="text"
                        placeholder="Buscar pratos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Desktop: Botão de filtro ao lado da pesquisa */}
                    <div className="hidden md:block relative w-56 lg:w-64">
                      <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="w-full bg-black text-white px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer text-sm md:text-base"
                      >
                        <div className="flex items-center gap-2">
                          <Filter size={18} />
                          <span>
                            Filtrar:{" "}
                            {selectedCategories.length > 0
                              ? selectedCategories.length
                              : "Todos"}
                          </span>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`transition-transform ${
                            isFilterOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isFilterOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-[1000]">
                          {[
                            "Todos",
                            ...categories.filter((cat) => cat !== "todos"),
                          ].map((category) => (
                            <button
                              key={category}
                              onClick={() => handleCategorySelect(category)}
                              className={`w-full text-left px-4 sm:px-6 py-2 sm:py-3 border-b border-gray-100 last:border-0 font-semibold transition-all flex items-center cursor-pointer text-sm sm:text-base ${
                                (category === "Todos" &&
                                  selectedCategories.length === 0) ||
                                selectedCategories.includes(category)
                                  ? "bg-black text-white"
                                  : "text-gray-700"
                              }`}
                            >
                              {category.replace(/\b\w/g, (l) =>
                                l.toUpperCase(),
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags dos filtros selecionados - Desktop (centralizadas abaixo) */}
                  {selectedCategories.length > 0 && (
                    <div className="hidden md:flex justify-center mb-4 sm:mb-6">
                      <div className="flex flex-wrap justify-center gap-2">
                        {selectedCategories.map((category) => (
                          <span
                            key={category}
                            className="bg-black text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm flex items-center gap-2"
                          >
                            {category.replace(/\b\w/g, (l) => l.toUpperCase())}
                            <button
                              onClick={() => removeCategory(category)}
                              className="cursor-pointer transition-opacity"
                            >
                              <X size={16} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-4 sm:mb-6 md:hidden">
                      <div className="flex justify-center mb-3 sm:mb-4">
                        <div className="relative w-full max-w-xs">
                          <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="w-full bg-black text-white px-3 sm:px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer text-xs sm:text-sm"
                          >
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Filter size={16} />
                              <span>
                                Filtrar:{" "}
                                {selectedCategories.length > 0
                                  ? selectedCategories.length
                                  : "Todos"}
                              </span>
                            </div>
                            <ChevronDown
                              size={16}
                              className={`transition-transform ${
                                isFilterOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {isFilterOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-[1000]">
                              {[
                                "Todos",
                                ...categories.filter((cat) => cat !== "todos"),
                              ].map((category) => (
                                <button
                                  key={category}
                                  onClick={() => handleCategorySelect(category)}
                                  className={`w-full text-left px-3 sm:px-4 py-1.5 sm:py-2 border-b border-gray-100 last:border-0 font-semibold transition-all flex items-center cursor-pointer text-xs sm:text-sm ${
                                    (category === "Todos" &&
                                      selectedCategories.length === 0) ||
                                    selectedCategories.includes(category)
                                      ? "bg-black text-white"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {category.replace(/\b\w/g, (l) =>
                                    l.toUpperCase(),
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Tags dos filtros selecionados - Mobile */}
                      {selectedCategories.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2">
                          {selectedCategories.map((category) => (
                            <span
                              key={category}
                              className="bg-black text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"
                            >
                              {category.replace(/\b\w/g, (l) =>
                                l.toUpperCase(),
                              )}
                              <button
                                onClick={() => removeCategory(category)}
                                className="cursor-pointer transition-opacity"
                              >
                                <X size={16} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                {(() => {
                  const filteredItems = menuItems.filter(
                    (item) =>
                      (selectedCategories.length === 0 ||
                        selectedCategories.includes(item.category)) &&
                      (searchQuery === "" ||
                        item.name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        item.description
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase())),
                  )

                  // Group items by category
                  const groupedItems = filteredItems.reduce(
                    (acc, item) => {
                      if (!acc[item.category]) {
                        acc[item.category] = []
                      }
                      acc[item.category].push(item)
                      return acc
                    },
                    {} as Record<string, MenuItem[]>,
                  )

                  // Renderizar categorias na ordem salva no banco de dados
                  const orderedCategoryKeys = categories
                    .filter((cat) => cat !== "todos" && groupedItems[cat])
                    .concat(
                      Object.keys(groupedItems).filter(
                        (cat) => !categories.includes(cat),
                      ),
                    )

                  return orderedCategoryKeys.map((category) => {
                    const items = [...groupedItems[category]].sort((a, b) =>
                      a.name.localeCompare(b.name, "pt-BR", {
                        sensitivity: "base",
                      }),
                    )
                    return (
                      <div key={category} className="mb-6 sm:mb-8">
                        <h2
                          className="relative z-10 text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 border-b pb-2 uppercase text-center"
                          style={{
                            WebkitTextStroke: ".5px black",
                            fontFamily: "Economica, sans-serif",
                          }}
                        >
                          {category}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="bg-white/35 backdrop-blur-sm rounded-lg shadow-sm p-3 sm:p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3 sm:gap-4">
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-16 h-16 xs:w-20 xs:h-20 object-cover rounded-lg flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0 w-full">
                                  <h3 className="font-bold text-sm xs:text-base sm:text-lg mb-1 line-clamp-2 text-black">
                                    {item.name}
                                  </h3>
                                  <button
                                    onClick={() => openItemDetails(item)}
                                    className="text-[#fff] hover:text-[#e1e1e1] text-xs xs:text-sm font-medium mb-2 block underline"
                                  >
                                    ver detalhes
                                  </button>
                                  <span className="text-base xs:text-lg sm:text-xl font-bold text-black block mb-2 xs:mb-0">
                                    R$ {item.price.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 w-full xs:w-auto">
                                  {!itemQuantitySelector[item.id] ? (
                                    <button
                                      onClick={() =>
                                        handleCartButtonClick(item.id)
                                      }
                                      className="flex-1 xs:flex-none bg-black text-white px-2 xs:px-3 py-1.5 xs:py-2 rounded-lg hover:bg-gray-800 transition-all flex items-center justify-center xs:justify-start gap-1 xs:gap-2 text-xs xs:text-sm"
                                    >
                                      <ShoppingCart className="w-3 h-3 xs:w-4 xs:h-4" />
                                      <Plus className="w-3 h-3 xs:w-4 xs:h-4" />
                                    </button>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-0.5 sm:gap-1">
                                        <button
                                          onClick={() =>
                                            decrementQuantity(item.id)
                                          }
                                          className="p-1.5 sm:p-2 hover:bg-gray-200 rounded transition"
                                        >
                                          <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                        <span className="font-bold w-7 sm:w-8 text-center text-sm sm:text-base">
                                          {itemQuantitySelector[item.id]}
                                        </span>
                                        <button
                                          onClick={() =>
                                            incrementQuantity(item.id)
                                          }
                                          className="p-1.5 sm:p-2 hover:bg-gray-200 rounded transition"
                                        >
                                          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                      </div>
                                      <button
                                        onClick={() => confirmAddToCart(item)}
                                        className="bg-black text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg hover:bg-gray-800 transition-all flex items-center gap-1 text-xs"
                                      >
                                        <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          ) : (
            /* Orders Tab */
            <div className="space-y-4 sm:space-y-6">
              {currentOrder ? (
                <div className="max-w-2xl mx-auto w-full">
                  <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 md:p-8 mb-4 sm:mb-6">
                    <div className="text-center mb-4 sm:mb-6">
                      <h2 className="text-xl sm:text-2xl font-bold mb-2">
                        Status do Pedido
                      </h2>
                      {currentOrder.assigned_to && (
                        <p className="text-xs sm:text-sm text-gray-500 mt-2">
                          Atendido por:{" "}
                          <span className="font-semibold text-gray-700">
                            {currentOrder.assigned_employee?.username ||
                              "Funcionário"}
                          </span>
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-600">
                        Pedido #{formatOrderNumericId(currentOrder.id)}
                      </p>
                    </div>

                    <div className="space-y-4 sm:space-y-6 min-h-48 sm:min-h-64 flex items-center justify-center">
                      {currentOrder.status === "pending" && (
                        <div className="text-center">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                            <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600" />
                          </div>
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-yellow-700 mb-1 sm:mb-2">
                            Aguardando confirmação
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                            Seu pedido foi enviado e está aguardando aprovação
                            do restaurante.
                          </p>
                          <button
                            onClick={() => cancelOrder(currentOrder.id)}
                            className="bg-red-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-red-600 transition flex items-center gap-2 mx-auto text-xs sm:text-sm"
                          >
                            <X className="w-3 h-3 sm:w-4 sm:h-4" />
                            Cancelar Pedido
                          </button>
                        </div>
                      )}

                      {currentOrder.status === "preparing" && (
                        <div className="text-center">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                            <ChefHat className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
                          </div>
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-blue-700 mb-1 sm:mb-2">
                            Preparando seu pedido
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Seu pedido está sendo preparado. Aguarde
                          </p>
                        </div>
                      )}

                      {currentOrder.status === "ready" && (
                        <div className="text-center">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                            <Utensils className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
                          </div>
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-green-700 mb-1 sm:mb-2">
                            Pedido pronto!
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Seu pedido está pronto. Aguarde que levaremos à sua
                            mesa em breve.
                          </p>
                        </div>
                      )}

                      {currentOrder.status === "completed" && (
                        <div className="text-center">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                            <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
                          </div>
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-green-700 mb-1 sm:mb-2">
                            Pedido finalizado
                          </h3>
                          <p className="text-xs sm:text-sm text-green-600 mb-3 sm:mb-4">
                            Seu pedido foi finalizado.
                          </p>
                        </div>
                      )}

                      {currentOrder.status === "cancelled" && (
                        <div className="text-center">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                            <X className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
                          </div>
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-red-700 mb-1 sm:mb-2">
                            Pedido cancelado
                          </h3>
                          <p className="text-xs sm:text-sm text-red-600">
                            Seu pedido foi cancelado.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Itens do Pedido */}
                    {currentOrderItems.length > 0 && (
                      <div className="mt-6 sm:mt-8 bg-gray-50 p-3 sm:p-4 md:p-6 rounded-lg">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                          Itens do Pedido
                        </h3>
                        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                          {currentOrderItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-start xs:items-center gap-2 py-2 border-b border-gray-200 last:border-b-0"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-xs sm:text-sm break-words">
                                  {item.menu_items?.name}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {item.quantity}x R$ {item.price.toFixed(2)}
                                </p>
                              </div>
                              <p className="font-semibold text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                                R$ {(item.price * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="border-t-2 border-gray-300 pt-3 sm:pt-4">
                          <div className="flex justify-between items-center">
                            <p className="text-base sm:text-lg font-bold text-gray-900">
                              Total
                            </p>
                            <p className="text-base sm:text-lg font-bold text-gray-900">
                              R$ {currentOrder.total.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 sm:mt-8 text-center">
                      <button
                        onClick={handleNewOrder}
                        className="bg-black text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition text-sm sm:text-base"
                      >
                        Fazer Novo Pedido
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <History className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-white mb-3 sm:mb-4" />
                  <p className="text-white text-base sm:text-lg mb-3 sm:mb-4">
                    Você ainda não fez nenhum pedido.
                  </p>
                  <button
                    onClick={handleNewOrder}
                    className="bg-black text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition text-sm sm:text-base"
                  >
                    Fazer Primeiro Pedido
                  </button>
                </div>
              )}

              {userOrders.length > 1 && (
                <div className="mt-6 sm:mt-8">
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                    Histórico de Pedidos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {userOrders.map((order) => (
                      <div
                        key={order.id}
                        className={`bg-white rounded-lg shadow-sm p-3 sm:p-4 cursor-pointer transition hover:shadow-md ${
                          order.id === currentOrder?.id
                            ? "ring-2 ring-black"
                            : ""
                        }`}
                        onClick={() => handleViewOrder(order)}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="font-semibold text-xs sm:text-sm">
                            Pedido #{formatOrderNumericId(order.id)}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                              order.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : order.status === "preparing"
                                  ? "bg-blue-100 text-blue-800"
                                  : order.status === "ready"
                                    ? "bg-green-100 text-green-800"
                                    : order.status === "cancelled"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {order.status === "pending"
                              ? "Aguardando"
                              : order.status === "preparing"
                                ? "Preparando"
                                : order.status === "ready"
                                  ? "Pronto"
                                  : order.status === "cancelled"
                                    ? "Cancelado"
                                    : "Finalizado"}
                          </span>
                        </div>
                        <p className="text-gray-600 text-xs sm:text-sm mb-1">
                          R$ {order.total.toFixed(2)}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {new Date(order.created_at).toLocaleString("pt-BR")}
                        </p>
                        {order.assigned_to && (
                          <p className="text-gray-500 text-xs mt-2">
                            Atendido por:{" "}
                            <span className="font-semibold text-gray-700">
                              {order.assigned_employee?.username ||
                                "Funcionário"}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Cart Modal */}
        {showCart && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 safe-area-bottom"
            onClick={() => setShowCart(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 sm:p-4 border-b">
                <h2 className="text-base sm:text-lg md:text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                  Carrinho
                </h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-1 hover:bg-gray-100 rounded transition"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="p-3 sm:p-4 max-h-[70vh] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-300 mb-3 sm:mb-4" />
                    <p className="text-gray-500 text-sm sm:text-base">
                      Carrinho vazio
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 sm:gap-3 bg-gray-50 p-2 sm:p-3 rounded-lg"
                        >
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-xs sm:text-sm truncate">
                              {item.name}
                            </h4>
                            <p className="text-gray-600 text-xs sm:text-sm">
                              R$ {item.price.toFixed(2)} cada
                            </p>
                            <p className="text-gray-800 font-semibold text-xs sm:text-sm">
                              Total: R${" "}
                              {(item.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-1 hover:bg-gray-200 rounded transition"
                            >
                              <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <span className="font-bold w-5 sm:w-6 text-center text-xs sm:text-sm">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="p-1 hover:bg-gray-200 rounded transition"
                            >
                              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 hover:bg-red-100 text-red-600 rounded transition flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-3 sm:pt-4 space-y-3 sm:space-y-4">
                      <div className="flex justify-between items-center text-base sm:text-lg font-bold">
                        <span>Total:</span>
                        <span>R$ {getTotal().toFixed(2)}</span>
                      </div>

                      {/* Payment Method Select */}
                      <div className="space-y-1.5 sm:space-y-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700">
                          Forma de Pagamento *
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        >
                          <option value="">Selecione...</option>
                          <option value="pix">PIX</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="cartao_credito">
                            Cartão de Crédito
                          </option>
                          <option value="cartao_debito">
                            Cartão de Débito
                          </option>
                        </select>
                      </div>

                      {/* Observations Textarea */}
                      <div className="space-y-1.5 sm:space-y-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700">
                          Observações (opcional)
                        </label>
                        <textarea
                          value={observations}
                          onChange={(e) => setObservations(e.target.value)}
                          placeholder="Ex: remover cebola, sem molho, etc."
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                          rows={3}
                        />
                      </div>

                      <button
                        onClick={handleFinishOrder}
                        disabled={!paymentMethod || loading}
                        className="w-full bg-black text-white py-2 sm:py-3 rounded-lg font-bold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                      >
                        {loading ? "Finalizando..." : "Finalizar Pedido"}
                      </button>

                      {!paymentMethod && (
                        <p className="text-red-500 text-xs text-center">
                          Selecione a forma de pagamento
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Item Details Modal */}
        {showItemDetails && selectedItem && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 safe-area-bottom"
            onClick={() => setShowItemDetails(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-white">
                <h2 className="text-base sm:text-lg md:text-xl font-bold truncate">
                  {selectedItem.name}
                </h2>
                <button
                  onClick={() => setShowItemDetails(false)}
                  className="p-1 hover:bg-gray-100 rounded transition flex-shrink-0 ml-2"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="p-3 sm:p-4">
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 object-cover rounded-lg mb-3 sm:mb-4 mx-auto"
                />

                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">
                      Detalhes
                    </h3>
                    <p className="text-gray-600 text-xs sm:text-sm">
                      {selectedItem.description}
                    </p>
                  </div>

                  <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 pt-3 sm:pt-4 border-t">
                    <span className="text-xl sm:text-2xl font-bold text-gray-900">
                      R$ {selectedItem.price.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <button
                          onClick={() =>
                            setSelectedItemQuantity(
                              Math.max(1, selectedItemQuantity - 1),
                            )
                          }
                          className="p-1.5 sm:p-2 hover:bg-gray-200 rounded transition"
                        >
                          <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span className="font-bold w-7 sm:w-8 text-center text-sm sm:text-base">
                          {selectedItemQuantity}
                        </span>
                        <button
                          onClick={() =>
                            setSelectedItemQuantity(selectedItemQuantity + 1)
                          }
                          className="p-1.5 sm:p-2 hover:bg-gray-200 rounded transition"
                        >
                          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          addToCart(selectedItem, selectedItemQuantity)
                          setShowItemDetails(false)
                        }}
                        className="bg-black text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg hover:bg-gray-800 transition flex items-center justify-center gap-2 text-xs sm:text-sm"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showToast && (
          <div className="fixed bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-3">
            <div className="bg-green-600 bg-opacity-90 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-md max-w-lg w-full text-center text-xs sm:text-sm">
              {toastMessage}
            </div>
          </div>
        )}

        {showUserQRCode && user?.username && user?.slug && (
          <UserQRCodeDisplay
            username={user.username}
            userSlug={user.slug}
            onClose={() => setShowUserQRCode(false)}
          />
        )}
      </div>
    </>
  )
}
