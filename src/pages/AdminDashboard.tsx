import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  LogOut,
  Users,
  ShoppingBag,
  Plus,
  Edit2,
  BookOpenCheck,
  Trash2,
  X,
  BarChart3,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Bell,
  Check,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { supabase, MenuItem, Order, OrderItem, User } from "../lib/supabase"
import { toast } from "react-toastify"
import jsPDF from "jspdf"
import { passwordSchema } from "../lib/validationSchemas"

type TabType =
  | "dashboard"
  | "menu"
  | "deactivated"
  | "orders"
  | "users"
  | "performance"

const API_BASE = import.meta.env.VITE_API_URL || ""

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

const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const formatOrderNumericId = (id: string) => {
  // deterministic hash to 3-digit numeric id (100-999)
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000
  }
  if (hash < 100) hash += 100
  return String(hash).padStart(3, "0")
}

const compareUsernames = (a: User, b: User) => {
  const nameA = (a.username ?? "").trim()
  const nameB = (b.username ?? "").trim()
  return nameA.localeCompare(nameB, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  })
}

const compareEmployeeUsernames = (
  a: { username: string },
  b: { username: string },
) => {
  const nameA = (a.username ?? "").trim()
  const nameB = (b.username ?? "").trim()
  return nameA.localeCompare(nameB, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  })
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>("dashboard")
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<
    (Order & { order_items?: OrderItem[]; users?: { username: string } })[]
  >([])
  const [users, setUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    category: "hamburguer",
    newCategory: "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [showUserModal, setShowUserModal] = useState(false)
  const [userFormData, setUserFormData] = useState({
    username: "",
    phone: "",
    password: "",
    is_admin: false,
    is_employee: false,
  })
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [showCategoryReorderModal, setShowCategoryReorderModal] =
    useState(false)
  const [orderedCategories, setOrderedCategories] = useState<string[]>([])
  const [showPendingRequestsModal, setShowPendingRequestsModal] =
    useState(false)
  const [pendingUsers, setPendingUsers] = useState<User[]>([])
  const [activeSessions, setActiveSessions] = useState<string[]>([])
  const [employeePerformance, setEmployeePerformance] = useState<
    Array<{
      userId: string
      username: string
      totalOrders: number
      totalRevenue: number
      completedOrders: number
      cancelledOrders: number
      averageOrderValue: number
    }>
  >([])
  const [selectedEmployeeCancelledOrders, setSelectedEmployeeCancelledOrders] =
    useState<any[]>([])
  const [selectedEmployeeForCancelled, setSelectedEmployeeForCancelled] =
    useState<string | null>(null)
  const [selectedEmployeeCompletedOrders, setSelectedEmployeeCompletedOrders] =
    useState<any[]>([])
  const [selectedEmployeeForCompleted, setSelectedEmployeeForCompleted] =
    useState<string | null>(null)
  const [showAllRecentOrders, setShowAllRecentOrders] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    fetchMenuItems()
    fetchOrders()
    fetchUsers()
    fetchPendingUsers()
  }, [])

  useEffect(() => {
    if (activeTab === "orders" || activeTab === "dashboard") {
      const interval = setInterval(() => {
        fetchOrders()
      }, 3000) // Atualizar pedidos a cada 3 segundos

      return () => clearInterval(interval)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === "performance") {
      calculateEmployeePerformance()

      // Atualizar performance a cada 3 segundos
      const interval = setInterval(() => {
        calculateEmployeePerformance()
      }, 3000)

      return () => clearInterval(interval)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === "users" || showPendingRequestsModal) {
      const interval = setInterval(() => {
        fetchPendingUsers()
      }, 2000) // Atualizar solicitações a cada 2 segundos

      return () => clearInterval(interval)
    }
  }, [activeTab, showPendingRequestsModal])

  useEffect(() => {
    if (activeTab === "users") {
      fetchActiveSessions()
      const interval = setInterval(() => {
        fetchActiveSessions()
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [activeTab])

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) {
      setMenuItems(data)
      const allCategories = [...new Set(data.map((item) => item.category))]

      // Carregar ordem salva do banco de dados
      const { data: categoryOrderData } = await supabase
        .from("category_order")
        .select("category, position")
        .order("position", { ascending: true })

      if (categoryOrderData && categoryOrderData.length > 0) {
        // Usar ordem do banco de dados
        const orderedCats = categoryOrderData
          .map((item) => item.category)
          .filter((cat) => allCategories.includes(cat))

        // Adicionar novas categorias que não estão no banco
        const newCats = allCategories.filter(
          (cat) => !orderedCats.includes(cat),
        )
        setCategories([...orderedCats, ...newCats])

        // Se há categorias novas, salvar no banco
        if (newCats.length > 0) {
          const maxPosition = categoryOrderData.length
          const newCategoryOrders = newCats.map((cat, index) => ({
            category: cat,
            position: maxPosition + index,
          }))
          await supabase.from("category_order").insert(newCategoryOrders)
        }
      } else {
        // Primeira vez - criar ordem inicial no banco
        setCategories(allCategories)
        const initialOrder = allCategories.map((cat, index) => ({
          category: cat,
          position: index,
        }))
        if (initialOrder.length > 0) {
          await supabase.from("category_order").insert(initialOrder)
        }
      }
    }
  }

  const fetchOrders = async () => {
    try {
      // Buscar pedidos básicos
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })

      if (ordersError || !ordersData) {
        setOrders([])
        return
      }

      // Buscar usuários
      const { data: usersData } = await supabase
        .from("users")
        .select("id, username")

      // Buscar itens de cada pedido
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*, menu_items(*)")

      // Montar dados completos
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
          assigned_employee: assignedEmployee
            ? { username: assignedEmployee.username }
            : null,
          order_items: items,
        }
      })

      setOrders(completeOrders as any[])
    } catch (error) {
      setOrders([])
    }
  }

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, username, phone, is_admin, is_employee, slug, created_at")
      .eq("approval_status", "approved")
      .order("created_at", { ascending: false })
    if (data) setUsers(data as User[])
  }

  const fetchPendingUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, username, is_admin, is_employee, slug, created_at")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true })
    if (data) setPendingUsers(data as User[])
  }

  const fetchActiveSessions = async () => {
    const { data, error } = await supabase
      .from("active_sessions")
      .select("username")

    if (!error) {
      setActiveSessions(data?.map((session: any) => session.username) || [])
    }
  }

  const handleOpenPendingRequests = () => {
    fetchPendingUsers()
    setShowPendingRequestsModal(true)
  }

  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ approval_status: "approved" })
        .eq("id", userId)

      if (error) {
        toast.error(
          "Não foi possível aprovar o usuário agora. Detalhes: " +
            error.message,
        )
        return
      }

      toast.success("Usuário aprovado! Ele já pode acessar o sistema.")
      fetchPendingUsers()
      fetchUsers()
    } catch (error) {
      toast.error("Não foi possível aprovar o usuário. Tente novamente.")
    }
  }

  const handleRejectUser = async (userId: string) => {
    try {
      const { error } = await supabase.from("users").delete().eq("id", userId)

      if (error) {
        toast.error(
          "Não foi possível recusar a solicitação. Detalhes: " + error.message,
        )
        return
      }

      toast.success("Solicitação recusada. O usuário não será cadastrado.")
      fetchPendingUsers()
    } catch (error) {
      toast.error("Não foi possível recusar a solicitação. Tente novamente.")
    }
  }

  const handleOpenCategoryReorder = () => {
    setOrderedCategories([...categories])
    setShowCategoryReorderModal(true)
  }

  const handleMoveCategoryUp = (index: number) => {
    if (index > 0) {
      const newOrder = [...orderedCategories]
      ;[newOrder[index], newOrder[index - 1]] = [
        newOrder[index - 1],
        newOrder[index],
      ]
      setOrderedCategories(newOrder)
    }
  }

  const handleMoveCategoryDown = (index: number) => {
    if (index < orderedCategories.length - 1) {
      const newOrder = [...orderedCategories]
      ;[newOrder[index], newOrder[index + 1]] = [
        newOrder[index + 1],
        newOrder[index],
      ]
      setOrderedCategories(newOrder)
    }
  }

  const handleSaveCategoryOrder = async () => {
    try {
      // Deletar ordem antiga
      await supabase
        .from("category_order")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")

      // Inserir nova ordem
      const categoryOrderData = orderedCategories.map((cat, index) => ({
        category: cat,
        position: index,
      }))

      const { error } = await supabase
        .from("category_order")
        .insert(categoryOrderData)

      if (error) {
        throw error
      }

      setCategories(orderedCategories)
      setShowCategoryReorderModal(false)
      toast.success("Ordem das categorias salva com sucesso.")
    } catch (error) {
      toast.error(
        "Não foi possível salvar a ordem das categorias. Detalhes: " +
          (error as Error).message,
      )
    }
  }

  const calculateEmployeePerformance = async () => {
    // Buscar todos os funcionários
    const { data: employees } = await supabase
      .from("users")
      .select("id, username")
      .eq("is_employee", true)

    if (!employees) return

    // Calcular performance de cada funcionário
    const performance = await Promise.all(
      employees.map(async (employee) => {
        // Buscar todos os pedidos onde esse funcionário foi atribuído
        // e que estão em status "ready", "completed" ou "cancelled"
        const { data: employeeOrders } = await supabase
          .from("orders")
          .select("*")
          .eq("assigned_to", employee.id)
          .neq("status", "pending")
          .neq("status", "preparing")

        const totalOrders =
          employeeOrders?.filter((o) => o.status !== "cancelled").length || 0
        const completedOrders =
          employeeOrders?.filter((o) => o.status === "completed").length || 0
        const cancelledOrders =
          employeeOrders?.filter((o) => o.status === "cancelled").length || 0
        const totalRevenue =
          employeeOrders
            ?.filter((o) => o.status === "completed")
            .reduce((sum, order) => sum + order.total, 0) || 0
        const averageOrderValue =
          completedOrders > 0 ? totalRevenue / completedOrders : 0

        return {
          userId: employee.id,
          username: employee.username,
          totalOrders,
          completedOrders,
          cancelledOrders,
          totalRevenue,
          averageOrderValue,
        }
      }),
    )

    setEmployeePerformance(performance.sort(compareEmployeeUsernames))
  }

  const handleViewCancelledOrders = async (employeeId: string) => {
    setSelectedEmployeeForCancelled(employeeId)
    setSelectedEmployeeForCompleted(null)

    // Buscar pedidos cancelados deste funcionário
    const { data: cancelledOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_to", employeeId)
      .eq("status", "cancelled")
      .order("created_at", { ascending: false })

    setSelectedEmployeeCancelledOrders(cancelledOrders || [])
  }

  const handleViewCompletedOrders = async (employeeId: string) => {
    setSelectedEmployeeForCompleted(employeeId)
    setSelectedEmployeeForCancelled(null)

    // Buscar pedidos finalizados deste funcionário
    const { data: completedOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_to", employeeId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })

    setSelectedEmployeeCompletedOrders(completedOrders || [])
  }

  const generateDailyReport = async () => {
    setGeneratingReport(true)
    try {
      // Pegar data de hoje
      const today = new Date()
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      )
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
      )

      // Buscar pedidos do dia com status concluído para calcular estatísticas
      const { data: dailyOrders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: false })

      if (ordersError || !dailyOrders) {
        toast.error("Não foi possível carregar os pedidos do dia.")
        setGeneratingReport(false)
        return
      }

      // Buscar itens dos pedidos para calcular top 5 vendidos
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*, menu_items(name)")
        .in(
          "order_id",
          dailyOrders.map((o) => o.id),
        )

      // Calcular estatísticas
      const totalOrders = dailyOrders.length
      const totalRevenue = dailyOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0,
      )
      // Valores não usados neste novo relatório, mas mantidos para referência
      // const completedOrders = dailyOrders.filter(
      //   (o) => o.status === "completed",
      // ).length;
      // const cancelledOrders = dailyOrders.filter(
      //   (o) => o.status === "cancelled",
      // ).length;

      // Calcular top 5 itens mais vendidos
      const itemSalesMap = new Map<string, { quantity: number; name: string }>()
      orderItems?.forEach((item) => {
        const name =
          (item.menu_items as { name: string })?.name || "Item desconhecido"
        const current = itemSalesMap.get(name) || { quantity: 0, name }
        current.quantity += item.quantity
        itemSalesMap.set(name, current)
      })

      const topItems = Array.from(itemSalesMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)

      // Calcular formas de pagamento com valor total
      const paymentMethodsData = new Map<
        string,
        { count: number; total: number }
      >()
      dailyOrders.forEach((order) => {
        const method = order.payment_method || "Não informado"
        const current = paymentMethodsData.get(method) || {
          count: 0,
          total: 0,
        }
        current.count += 1
        current.total += order.total || 0
        paymentMethodsData.set(method, current)
      })

      // Buscar informações detalhadas de funcionários
      const { data: employees } = await supabase
        .from("users")
        .select("id, username")
        .eq("is_employee", true)

      const employeePerformanceMap = new Map<
        string,
        {
          username: string
          completedOrders: number
          cancelledOrders: number
          totalRevenue: number
        }
      >()

      if (employees) {
        employees.forEach((emp) => {
          employeePerformanceMap.set(emp.id, {
            username: emp.username,
            completedOrders: 0,
            cancelledOrders: 0,
            totalRevenue: 0,
          })
        })

        // Calcular performance de cada funcionário
        dailyOrders.forEach((order) => {
          if (
            order.assigned_to &&
            employeePerformanceMap.has(order.assigned_to)
          ) {
            const perf = employeePerformanceMap.get(order.assigned_to)!
            if (order.status === "completed") {
              perf.completedOrders += 1
              perf.totalRevenue += order.total || 0
            } else if (order.status === "cancelled") {
              perf.cancelledOrders += 1
            }
          }
        })
      }

      // Criar PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 15
      let yPosition = margin

      const ensurePageSpace = (needed: number) => {
        if (yPosition + needed > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
        }
      }

      const drawTable = (
        title: string,
        headers: string[],
        rows: Array<Array<string | number>>,
        columnWidths?: number[],
      ) => {
        const tableWidth = pageWidth - margin * 2
        const widths =
          columnWidths && columnWidths.length === headers.length
            ? columnWidths
            : headers.map(() => tableWidth / headers.length)
        const headerHeight = 7
        const rowHeight = 6
        const cellPadding = 2

        ensurePageSpace(10)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(12)
        pdf.setTextColor(170, 52, 28)
        pdf.text(title, margin, yPosition)
        yPosition += 6

        ensurePageSpace(headerHeight + rowHeight)
        let x = margin
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(10)
        headers.forEach((header, index) => {
          pdf.setFillColor(245, 245, 245)
          pdf.setDrawColor(220, 220, 220)
          pdf.rect(x, yPosition, widths[index], headerHeight, "F")
          pdf.rect(x, yPosition, widths[index], headerHeight)
          pdf.setTextColor(50, 50, 50)
          pdf.text(header, x + cellPadding, yPosition + 4.8)
          x += widths[index]
        })
        yPosition += headerHeight

        const safeRows = rows.length > 0 ? rows : [["Sem dados"]]
        safeRows.forEach((row) => {
          ensurePageSpace(rowHeight)
          let xRow = margin
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(9)
          row.forEach((cell, index) => {
            const width = widths[index] ?? widths[0]
            pdf.setDrawColor(220, 220, 220)
            pdf.rect(xRow, yPosition, width, rowHeight)
            pdf.setTextColor(0, 0, 0)
            pdf.text(String(cell), xRow + cellPadding, yPosition + 4.2)
            xRow += width
          })
          yPosition += rowHeight
        })

        yPosition += 12
      }

      // ========== CABEÇALHO ==========
      // Foto centralizada
      const imgWidth = 30
      const imgHeight = 30
      const xCenter = pageWidth / 2 - imgWidth / 2

      // Função para carregar imagem
      const createImageData = async () => {
        try {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")
          if (!ctx) return

          const size = 300
          canvas.width = size
          canvas.height = size

          // Carregar imagem
          const img = new Image()
          img.crossOrigin = "anonymous"

          return new Promise<string>((resolve) => {
            img.onload = () => {
              ctx.clearRect(0, 0, size, size)
              ctx.drawImage(img, 0, 0, size, size)
              resolve(canvas.toDataURL("image/png"))
            }

            img.onerror = () => {
              resolve("")
            }

            img.src = "/public/assets/iconpngorange.png"
          })
        } catch (e) {
          return ""
        }
      }

      // Adicionar imagem
      const imageData = await createImageData()
      if (imageData) {
        try {
          pdf.addImage(
            imageData,
            "PNG",
            xCenter,
            yPosition,
            imgWidth,
            imgHeight,
          )
        } catch (e) {
          // Silently fail if image can't be added
        }
      }

      yPosition += imgHeight + 8

      // Subtítulo "Relatório diário" centralizado
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(21)
      pdf.setTextColor(51, 51, 51)
      pdf.text("Relatório Diário", pageWidth / 2, yPosition, {
        align: "center",
      })

      yPosition += 10

      // Data por extenso no lado esquerdo
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(11)
      pdf.setTextColor(102, 102, 102)
      const dateStr = today.toLocaleDateString("pt-BR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      const capitalizedDateStr =
        dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
      pdf.text(capitalizedDateStr, margin, yPosition)

      yPosition += 5

      // Linha separadora
      pdf.setDrawColor(170, 52, 28)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)

      yPosition += 8

      // ========== RESUMO GERAL ==========
      drawTable(
        "Resumo Geral",
        ["Item", "Quantidade"],
        [
          ["Total de Pedidos", totalOrders],
          ["Faturamento Total", `R$ ${totalRevenue.toFixed(2)}`],
        ],
        [90, 90],
      )

      // ========== TOP 5 ITENS MAIS VENDIDOS ==========
      drawTable(
        "Itens Mais Vendidos",
        ["Item", "Quantidade"],
        topItems.map((item) => [item.name, `${item.quantity} un`]),
        [120, 60],
      )

      // ========== FORMAS DE PAGAMENTO ==========
      const paymentRows = Array.from(paymentMethodsData.entries()).map(
        ([method, data]) => {
          const methodLabel =
            method === "pix"
              ? "PIX"
              : method === "dinheiro"
                ? "Dinheiro"
                : method === "cartao_credito"
                  ? "Cartão de Crédito"
                  : method === "cartao_debito"
                    ? "Cartão de Débito"
                    : method
          return [methodLabel, data.count, `R$ ${data.total.toFixed(2)}`]
        },
      )

      drawTable(
        "Formas de Pagamento",
        ["Método", "Transações", "Total"],
        paymentRows,
        [80, 40, 60],
      )

      // ========== PERFORMANCE DOS FUNCIONÁRIOS ==========
      if (employees && employees.length > 0) {
        const perfRows = Array.from(employeePerformanceMap.values()).map(
          (perf) => [
            perf.username,
            perf.completedOrders,
            perf.cancelledOrders,
            `R$ ${perf.totalRevenue.toFixed(2)}`,
          ],
        )
        drawTable(
          "Performance dos Funcionários",
          ["Funcionário", "Finalizados", "Cancelados", "Valor Total"],
          perfRows,
          [70, 35, 35, 40],
        )
      }

      // Footer
      yPosition = pageHeight - margin - 5
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(0, 0, 0)
      pdf.text(
        `Relatório gerado em ${new Date().toLocaleString("pt-BR")}`,
        pageWidth / 2,
        yPosition,
        { align: "center" },
      )

      // Download PDF
      const fileName = `relatorio_diario_${today.toISOString().split("T")[0]}.pdf`
      pdf.save(fileName)

      toast.success("Relatório diário gerado e baixado com sucesso.")
    } catch (error) {
      toast.error("Não foi possível gerar o relatório. Tente novamente.")
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault()

    let imageUrl = formData.image_url

    // Se há arquivo de imagem para upload
    if (imageFile) {
      try {
        const fileName = `${Date.now()}-${imageFile.name}`
        const { error: uploadError } = await supabase.storage
          .from("menu-items")
          .upload(fileName, imageFile)

        if (uploadError) {
          toast.error(
            "Falha ao enviar a imagem. Detalhes: " + uploadError.message,
          )
          return
        }

        // Obter URL pública da imagem
        const { data: publicUrl } = supabase.storage
          .from("menu-items")
          .getPublicUrl(fileName)

        imageUrl = publicUrl.publicUrl
      } catch (error) {
        toast.error(
          "Falha ao enviar a imagem. Detalhes: " + (error as Error).message,
        )
        return
      }
    }

    const itemData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      image_url: imageUrl,
      category: formData.newCategory || formData.category,
      active: true,
    }

    if (editingItem) {
      await supabase
        .from("menu_items")
        .update(itemData)
        .eq("id", editingItem.id)
    } else {
      await supabase.from("menu_items").insert(itemData)
    }

    // Adicionar nova categoria ao array categories imediatamente
    if (formData.newCategory && !categories.includes(formData.newCategory)) {
      setCategories((prev) => [...new Set([...prev, formData.newCategory])])
    }

    setShowMenuModal(false)
    setEditingItem(null)
    setImageFile(null)
    setImagePreview("")
    setFormData({
      name: "",
      description: "",
      price: "",
      image_url: "",
      category: "hamburguer",
      newCategory: "",
    })
    fetchMenuItems()
    toast.success(
      editingItem
        ? "Item atualizado com sucesso."
        : "Item adicionado ao cardápio com sucesso.",
    )
  }

  const handleImageSelection = (file?: File | null) => {
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Determinar a senha a ser usada
      let password = userFormData.password

      // Se for cliente/mesa (não é admin nem funcionário), gerar senha padrão
      if (!userFormData.is_admin && !userFormData.is_employee) {
        password = `Mesa${userFormData.username}@2024`
      } else {
        // Para admin e funcionário, validar a senha com Zod
        const passwordValidation = passwordSchema.safeParse(
          userFormData.password,
        )

        if (!passwordValidation.success) {
          const firstIssue = passwordValidation.error.issues?.[0]
          const errorMessage = firstIssue?.message || "Senha inválida."
          toast.error(`Senha inválida: ${errorMessage}`)
          return
        }
      }

      // Verificar se o usuário já existe
      const { data: existingUser } = await supabase
        .from("users")
        .select("username")
        .eq("username", userFormData.username)
        .maybeSingle()

      if (existingUser) {
        toast.error("Já existe um usuário com esse nome. Escolha outro.")
        return
      }

      // Gerar telefone padrão quando não informado
      const phone = userFormData.phone || "0000000000"

      const response = await fetch(`${API_BASE}/api/admin/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userFormData.username,
          phone,
          password: password,
          is_admin: userFormData.is_admin,
          is_employee: userFormData.is_employee,
        }),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        toast.error(
          "Não foi possível criar o usuário. Detalhes: " +
            (result?.error || "erro desconhecido"),
        )
        return
      }

      setShowUserModal(false)
      setUserFormData({
        username: "",
        phone: "",
        password: "",
        is_admin: false,
        is_employee: false,
      })
      fetchUsers()
      toast.success("Usuário criado e liberado para acesso.")
    } catch (error) {
      toast.error(
        "Não foi possível criar o usuário. Detalhes: " +
          (error as Error).message,
      )
    }
  }

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      image_url: item.image_url,
      category: item.category,
      newCategory: "",
    })
    setShowMenuModal(true)
  }

  const handleDeleteItem = async (id: string) => {
    if (confirm("Deseja realmente excluir este item?")) {
      try {
        // Verificar se o item está em algum pedido
        const { data: orderItems, error: checkError } = await supabase
          .from("order_items")
          .select("id")
          .eq("menu_item_id", id)

        if (checkError) {
          toast.error(
            "Não foi possível verificar pedidos vinculados a este item. Detalhes: " +
              checkError.message,
          )
          return
        }

        if (orderItems && orderItems.length > 0) {
          toast.warning(
            "Não é possível excluir este item porque ele está associado a pedidos existentes. Desative o item em vez de excluí-lo.",
          )
          return
        }

        // Se não há pedidos, pode deletar
        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", id)
        if (error) {
          toast.error(
            "Não foi possível excluir o item. Detalhes: " + error.message,
          )
          return
        }
        toast.success("Item excluído com sucesso.")
        fetchMenuItems()
      } catch (error) {
        toast.error(
          "Não foi possível excluir o item. Detalhes: " +
            (error as Error).message,
        )
      }
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await supabase
      .from("menu_items")
      .update({ active: !currentActive })
      .eq("id", id)
    fetchMenuItems()
  }

  const handleDeleteOrder = async (orderId: string) => {
    await supabase.from("orders").update({ hidden: true }).eq("id", orderId)
    toast.success("Pedido ocultado da lista com sucesso.")
    fetchOrders()
  }

  const handleClearData = async () => {
    if (
      confirm(
        "⚠️ ATENÇÃO: Esta ação irá APAGAR TODOS os pedidos permanentemente do banco de dados. Esta ação não pode ser desfeita. Deseja continuar?",
      )
    ) {
      // Perguntar se deseja baixar o relatório antes de limpar
      const downloadReport = confirm(
        "📊 Caso não tenha baixado o relatório diário, deseja baixá-lo antes de limpar os dados?",
      )

      try {
        // Se o usuário escolheu baixar o relatório, gera primeiro
        if (downloadReport) {
          await generateDailyReport()
          // Aguardar um pouco para garantir que o download foi iniciado
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        // Apagar pedidos
        await supabase
          .from("orders")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000")

        // Apagar notificações de garçom
        await supabase
          .from("waiter_calls")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000")

        toast.success("Pedidos e chamadas foram apagados permanentemente.")
        fetchOrders()
      } catch (error) {
        toast.error(
          "Não foi possível limpar os dados. Detalhes: " +
            (error as Error).message,
        )
      }
    }
  }

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    if (
      confirm(
        `Deseja ${currentAdmin ? "remover" : "conceder"} permissão de administrador?`,
      )
    ) {
      await supabase
        .from("users")
        .update({
          is_admin: !currentAdmin,
          is_employee: currentAdmin ? true : false,
        })
        .eq("id", userId)
      fetchUsers()
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Deseja realmente remover este usuário?")) {
      return
    }

    try {
      await supabase.from("users").delete().eq("id", userId)
      fetchUsers()
      toast.success("Usuário removido com sucesso.")
    } catch (error) {
      toast.error(
        "Não foi possível remover o usuário. Detalhes: " +
          (error as Error).message,
      )
    }
  }

  const toggleUserAccordion = (username: string) => {
    setExpandedUsers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(username)) {
        newSet.delete(username)
      } else {
        newSet.add(username)
      }
      return newSet
    })
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-white text-black shadow-lg sticky top-0 z-40">
        <div className="w-full py-8 px-3 sm:px-4 sm:py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              Painel de Administrador
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
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm sm:text-base"
          >
            <LogOut className="w-10 h-5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="w-full px-3 sm:px-4 py-4 sm:py-8">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
          <div className="border-b overflow-x-auto">
            <div className="flex min-w-max sm:min-w-0">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex-1 min-w-20 sm:min-w-0 px-2 sm:px-6 py-3 sm:py-4 font-semibold flex items-center justify-center gap-1 sm:gap-2 transition text-xs sm:text-base ${
                  activeTab === "dashboard"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <BarChart3 className="w-4 sm:w-5 h-4 sm:h-5" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab("menu")}
                className={`flex-1 min-w-20 sm:min-w-0 px-2 sm:px-6 py-3 sm:py-4 font-semibold flex items-center justify-center gap-1 sm:gap-2 transition text-xs sm:text-base ${
                  activeTab === "menu"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Edit2 className="w-4 sm:w-5 h-4 sm:h-5" />
                <span className="hidden sm:inline">Editar</span>
              </button>
              <button
                onClick={() => setActiveTab("deactivated")}
                className={`flex-1 min-w-20 sm:min-w-0 px-2 sm:px-6 py-3 sm:py-4 font-semibold flex items-center justify-center gap-1 sm:gap-2 transition text-xs sm:text-base ${
                  activeTab === "deactivated"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <X className="w-4 sm:w-5 h-4 sm:h-5" />
                <span className="hidden sm:inline">Desativados</span>
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex-1 min-w-20 sm:min-w-0 px-2 sm:px-6 py-3 sm:py-4 font-semibold flex items-center justify-center gap-1 sm:gap-2 transition text-xs sm:text-base ${
                  activeTab === "orders"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ShoppingBag className="w-4 sm:w-5 h-4 sm:h-5" />
                <span className="hidden sm:inline">Pedidos</span>
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`relative flex-1 min-w-20 sm:min-w-0 px-2 sm:px-6 py-3 sm:py-4 font-semibold flex items-center justify-center gap-1 sm:gap-2 transition text-xs sm:text-base ${
                  activeTab === "users"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="relative flex items-center">
                  <Users className="w-4 sm:w-5 h-4 sm:h-5" />
                  {pendingUsers.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] leading-none min-w-4 h-4 px-1 rounded-full flex items-center justify-center sm:hidden">
                      {pendingUsers.length}
                    </span>
                  )}
                </span>
                <span className="relative hidden sm:inline">
                  Usuários
                  {pendingUsers.length > 0 && (
                    <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] leading-none min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                      {pendingUsers.length}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("performance")}
                className={`flex-1 min-w-20 sm:min-w-0 px-2 sm:px-6 py-3 sm:py-4 font-semibold flex items-center justify-center gap-1 sm:gap-2 transition text-xs sm:text-base ${
                  activeTab === "performance"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <BarChart3 className="w-4 sm:w-5 h-4 sm:h-5" />
                <span className="hidden sm:inline">Performance</span>
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-6 overflow-y-auto flex-1">
            {activeTab === "deactivated" && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">
                  Itens Desativados
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                  {menuItems.filter((item) => !item.active).length === 0 ? (
                    <p className="text-gray-500 col-span-full text-sm">
                      Nenhum item desativado.
                    </p>
                  ) : (
                    menuItems
                      .filter((item) => !item.active)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="border rounded-lg overflow-hidden opacity-50 bg-gray-100"
                        >
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full aspect-square object-cover"
                          />
                          <div className="p-2 sm:p-3">
                            <h3 className="font-bold text-xs sm:text-base mb-1 text-black line-clamp-2">
                              {item.name}
                            </h3>
                            <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">
                              {item.category}
                            </p>
                            <p
                              className="text-gray-600 text-xs line-clamp-2"
                              style={{
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                              }}
                            >
                              {item.description}
                            </p>
                            <p className="text-sm sm:text-lg font-bold text-black mb-2 mt-1">
                              R$ {item.price.toFixed(2)}
                            </p>
                            <button
                              onClick={() =>
                                handleToggleActive(item.id, item.active)
                              }
                              className="w-full px-2 sm:px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-xs sm:text-base font-bold"
                            >
                              Ativar Item
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
            {activeTab === "dashboard" && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">
                  Dashboard
                </h2>

                {/* Cards de estatísticas */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
                  <div className="bg-gray-50 p-3 sm:p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-600">
                          Pedidos Hoje
                        </p>
                        <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                          {
                            orders.filter((order) => {
                              const today = new Date().toDateString()
                              const orderDate = new Date(
                                order.created_at,
                              ).toDateString()
                              return (
                                orderDate === today &&
                                order.status !== "cancelled"
                              )
                            }).length
                          }
                        </p>
                      </div>
                      <ShoppingBag className="w-6 sm:w-8 h-6 sm:h-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 sm:p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-600">
                          Receita Hoje
                        </p>
                        <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                          R${" "}
                          {orders
                            .filter((order) => {
                              const today = new Date().toDateString()
                              const orderDate = new Date(
                                order.created_at,
                              ).toDateString()
                              return (
                                orderDate === today &&
                                order.status !== "cancelled"
                              )
                            })
                            .reduce((sum, order) => sum + order.total, 0)
                            .toFixed(2)}
                        </p>
                      </div>
                      <BarChart3 className="w-6 sm:w-8 h-6 sm:h-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 sm:p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-600">
                          Usuários
                        </p>
                        <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                          {users.length}
                        </p>
                      </div>
                      <Users className="w-6 sm:w-8 h-6 sm:h-8 text-purple-600" />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 sm:p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-600">
                          Cardápio
                        </p>
                        <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                          {menuItems.length}
                        </p>
                      </div>
                      <BookOpenCheck className="w-6 sm:w-8 h-6 sm:h-8 text-orange-600" />
                    </div>
                  </div>
                </div>

                {/* Status dos pedidos - Responsivo */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                      Status dos Pedidos
                    </h3>
                    <div className="space-y-3">
                      {/* Pipeline de pedidos */}
                      <div className="border-l-4 border-yellow-400 pl-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            Em Fila
                          </span>
                          <span className="text-base sm:text-lg font-bold text-yellow-600">
                            {
                              orders
                                .filter((order) => !order.hidden)
                                .filter((order) => order.status === "pending")
                                .length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Aguardando aprovação
                        </p>
                      </div>

                      <div className="border-l-4 border-blue-400 pl-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            Em Preparo
                          </span>
                          <span className="text-base sm:text-lg font-bold text-blue-600">
                            {
                              orders
                                .filter((order) => !order.hidden)
                                .filter((order) => order.status === "preparing")
                                .length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Sendo preparado</p>
                      </div>

                      <div className="border-l-4 border-green-400 pl-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            Pronto
                          </span>
                          <span className="text-base sm:text-lg font-bold text-green-600">
                            {
                              orders
                                .filter((order) => !order.hidden)
                                .filter((order) => order.status === "ready")
                                .length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Aguardando retirada
                        </p>
                      </div>

                      <div className="border-l-4 border-gray-400 pl-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            Finalizado
                          </span>
                          <span className="text-base sm:text-lg font-bold text-gray-600">
                            {
                              orders.filter(
                                (order) => order.status === "completed",
                              ).length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Pedido concluído
                        </p>
                      </div>

                      <div className="border-l-4 border-red-400 pl-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            Cancelado
                          </span>
                          <span className="text-base sm:text-lg font-bold text-red-600">
                            {
                              orders.filter(
                                (order) => order.status === "cancelled",
                              ).length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Pedido cancelado
                        </p>
                      </div>

                      {/* Resumo do pipeline */}
                      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            Total em Andamento
                          </span>
                          <span className="text-base sm:text-lg font-bold text-purple-600">
                            {
                              orders
                                .filter((order) => !order.hidden)
                                .filter((order) =>
                                  ["pending", "preparing", "ready"].includes(
                                    order.status,
                                  ),
                                ).length
                            }
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 mt-1">
                          Pedidos ativos no sistema
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                      Itens Mais Vendidos (Hoje)
                    </h3>
                    <div className="space-y-3">
                      {(() => {
                        const today = new Date().toDateString()
                        const todayOrders = orders.filter(
                          (order) =>
                            new Date(order.created_at).toDateString() ===
                              today && order.status === "completed",
                        )

                        const itemCounts: {
                          [key: string]: { name: string; count: number }
                        } = {}

                        todayOrders.forEach((order) => {
                          order.order_items?.forEach((item) => {
                            if (item.menu_items) {
                              const itemName = item.menu_items.name
                              if (itemCounts[itemName]) {
                                itemCounts[itemName].count += item.quantity
                              } else {
                                itemCounts[itemName] = {
                                  name: itemName,
                                  count: item.quantity,
                                }
                              }
                            }
                          })
                        })

                        const sortedItems = Object.values(itemCounts)
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 5)

                        return sortedItems.length > 0 ? (
                          sortedItems.map((item) => (
                            <div
                              key={item.name}
                              className="flex justify-between items-center text-xs sm:text-sm"
                            >
                              <span className="text-gray-600 line-clamp-1">
                                {item.name}
                              </span>
                              <span className="font-semibold text-gray-900 ml-2">
                                {item.count}x
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs sm:text-sm text-gray-500">
                            Nenhum pedido hoje
                          </p>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Pedidos recentes */}
                <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border mb-4 sm:mb-8">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                    Pedidos Recentes
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {(showAllRecentOrders ? orders : orders.slice(0, 3)).map(
                      (order) => (
                        <div
                          key={order.id}
                          className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-gray-200 last:border-b-0 gap-2"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-xs sm:text-base text-gray-900 line-clamp-1">
                              Pedido da Mesa{" "}
                              {order.users?.username || "Cliente"} •{" "}
                              <span className="text-gray-600">
                                {new Date(order.created_at).toLocaleString(
                                  "pt-BR",
                                  {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </p>
                            <p className="text-xs text-gray-600">
                              Pedido #{formatOrderNumericId(order.id)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm sm:text-base text-gray-900">
                              R$ {order.total.toFixed(2)}
                            </p>
                            <p
                              className={`text-xs px-2 py-1 rounded-full w-fit ml-auto ${
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
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                    {orders.length === 0 && (
                      <p className="text-xs sm:text-sm text-gray-500">
                        Nenhum pedido recente.
                      </p>
                    )}
                  </div>
                  {orders.length > 3 && (
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                      <button
                        onClick={() =>
                          setShowAllRecentOrders(!showAllRecentOrders)
                        }
                        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition font-medium text-sm sm:text-base"
                      >
                        {showAllRecentOrders ? "Ver menos" : "Ver todos"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Botão de gerar relatório */}
                <div className="bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-200 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-1 sm:mb-2">
                        📊 Gerar Relatório Diário
                      </h3>
                      <p className="text-xs sm:text-sm text-blue-700">
                        Gera um relatório em PDF com todas as informações
                        diárias, incluindo pedidos, faturamento, formas de
                        pagamento e performance.
                      </p>
                    </div>
                    <button
                      onClick={generateDailyReport}
                      disabled={generatingReport}
                      className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition font-semibold text-sm sm:text-base whitespace-nowrap"
                    >
                      {generatingReport ? "Gerando..." : "Gerar PDF"}
                    </button>
                  </div>
                </div>

                {/* Botão de limpar dados */}
                <div className="bg-red-50 p-4 sm:p-6 rounded-lg border border-red-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-red-900 mb-1 sm:mb-2">
                        ⚠️ Limpar Dados
                      </h3>
                      <p className="text-xs sm:text-sm text-red-700">
                        Apaga permanentemente todos os pedidos do banco de
                        dados. Esta ação não pode ser desfeita.
                      </p>
                    </div>
                    <button
                      onClick={handleClearData}
                      className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold text-sm sm:text-base whitespace-nowrap"
                    >
                      Limpar Dados
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "menu" && (
              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-black">
                    Gerenciar Cardápio
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleOpenCategoryReorder}
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs sm:text-sm"
                    >
                      📊 Reordenar
                    </button>
                    <button
                      onClick={() => {
                        setEditingItem(null)
                        setFormData({
                          name: "",
                          description: "",
                          price: "",
                          image_url: "",
                          category: "",
                          newCategory: "",
                        })
                        setShowMenuModal(true)
                      }}
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-xs sm:text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Item
                    </button>
                  </div>
                </div>

                {/* Menu Items */}
                {(() => {
                  const activeItems = menuItems.filter((item) => item.active)

                  // Group items by category
                  const groupedItems = activeItems.reduce(
                    (acc, item) => {
                      if (!acc[item.category]) {
                        acc[item.category] = []
                      }
                      acc[item.category].push(item)
                      return acc
                    },
                    {} as Record<string, MenuItem[]>,
                  )

                  const orderedCategoryKeys = categories
                    .filter((cat) => groupedItems[cat])
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
                        <h3 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4 border-b pb-2">
                          {category.replace(/\b\w/g, (l) => l.toUpperCase())}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="border rounded-lg overflow-hidden flex flex-col"
                            >
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full aspect-square object-cover"
                              />
                              <div className="p-2 sm:p-3 flex-1 flex flex-col">
                                <h3 className="font-bold text-xs sm:text-base mb-1 text-black line-clamp-2">
                                  {item.name}
                                </h3>
                                <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">
                                  {item.category}
                                </p>
                                <p className="text-gray-600 text-xs line-clamp-2 mb-2 flex-1">
                                  {item.description}
                                </p>
                                <p className="text-sm sm:text-lg font-bold text-black mb-2">
                                  R$ {item.price.toFixed(2)}
                                </p>
                                <div className="flex gap-1 flex-col sm:flex-row">
                                  <button
                                    onClick={() => handleEditItem(item)}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-gray-100 text-black rounded hover:bg-gray-200 transition text-xs"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span className="hidden sm:inline">
                                      Editar
                                    </span>
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleToggleActive(item.id, item.active)
                                    }
                                    className="flex-1 px-2 py-1 bg-gray-100 text-black rounded hover:bg-gray-200 transition text-xs"
                                  >
                                    Desativar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition flex items-center justify-center"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
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
            )}

            {activeTab === "orders" && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">
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
                      <p className="text-xs sm:text-sm text-gray-500">
                        Não há pedidos no momento
                      </p>
                    ) : (
                      Object.entries(ordersByUser).map(
                        ([username, userOrders]) => (
                          <div
                            key={username}
                            className="border rounded-lg bg-gray-50"
                          >
                            <button
                              onClick={() => toggleUserAccordion(username)}
                              className="w-full text-left p-3 sm:p-4 font-bold text-base sm:text-lg text-black hover:bg-gray-100 transition flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="truncate">
                                  Pedidos da Mesa {username}
                                </span>
                                {userOrders.some(
                                  (o) => o.status === "pending",
                                ) && (
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
                                className={`w-5 h-5 transition-transform flex-shrink-0 ml-2 ${expandedUsers.has(username) ? "rotate-180" : ""}`}
                              />
                            </button>
                            {expandedUsers.has(username) && (
                              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                                {userOrders.map((order) => (
                                  <div
                                    key={order.id}
                                    className="border rounded-lg p-3 sm:p-4 bg-white text-sm sm:text-base"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <h3 className="font-bold text-sm sm:text-lg text-black">
                                            Pedido da Mesa{" "}
                                            {order.users?.username || "Cliente"}
                                          </h3>
                                          {order.assigned_employee && (
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap">
                                              {order.assigned_employee.username}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-600">
                                          Pedido #
                                          {formatOrderNumericId(order.id)}
                                        </p>
                                        <p className="text-xs sm:text-sm text-gray-600">
                                          {new Date(
                                            order.created_at,
                                          ).toLocaleString("pt-BR", {
                                            month: "2-digit",
                                            day: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </p>
                                      </div>
                                      <div className="text-right sm:text-right">
                                        <p className="text-base sm:text-2xl font-bold text-black">
                                          R$ {order.total.toFixed(2)}
                                        </p>
                                        {order.status === "pending" && (
                                          <span className="px-2 sm:px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs inline-block">
                                            Aguardando
                                          </span>
                                        )}
                                        {order.status === "preparing" && (
                                          <span className="px-2 sm:px-3 py-1 bg-gray-500 text-white rounded-lg text-xs inline-block">
                                            Preparando
                                          </span>
                                        )}
                                        {order.status === "ready" && (
                                          <span className="px-2 sm:px-3 py-1 bg-gray-500 text-white rounded-lg text-xs inline-block">
                                            Pronto
                                          </span>
                                        )}
                                        {order.status === "completed" && (
                                          <div className="mt-1 sm:mt-2 flex items-center gap-1 sm:gap-2 justify-end">
                                            <span className="px-2 sm:px-3 py-1 bg-gray-500 text-white rounded-lg text-xs">
                                              Finalizado
                                            </span>
                                            <button
                                              onClick={() =>
                                                handleDeleteOrder(order.id)
                                              }
                                              className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                                              title="Ocultar pedido"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                        {order.status === "cancelled" && (
                                          <div className="mt-1 sm:mt-2 flex items-center gap-1 sm:gap-2 justify-end">
                                            <span className="px-2 sm:px-3 py-1 bg-red-500 text-white rounded-lg text-xs">
                                              Cancelado
                                            </span>
                                            <button
                                              onClick={() =>
                                                handleDeleteOrder(order.id)
                                              }
                                              className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                                              title="Ocultar pedido"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="space-y-1 text-xs sm:text-sm">
                                      {order.order_items?.map((item) => (
                                        <div
                                          key={item.id}
                                          className="text-gray-700"
                                        >
                                          <div className="flex justify-between">
                                            <span>
                                              {item.quantity}x{" "}
                                              {item.menu_items?.name}
                                            </span>
                                            <span>
                                              R${" "}
                                              {(
                                                item.price * item.quantity
                                              ).toFixed(2)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Informações adicionais do pedido */}
                                    {(order.payment_method ||
                                      order.observations) && (
                                      <div className="mt-3 sm:mt-4 space-y-2">
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
                                            <p className="text-xs sm:text-sm text-gray-700">
                                              <strong className="text-gray-900">
                                                Obs:
                                              </strong>{" "}
                                              {order.observations}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ),
                      )
                    )
                  })()}
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-black">
                    Usuários
                  </h2>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <button
                      onClick={handleOpenPendingRequests}
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs sm:text-sm w-full sm:w-auto"
                    >
                      {pendingUsers.length > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {pendingUsers.length}
                        </span>
                      )}
                      <Bell className="w-4 h-4" />
                      Solicitações
                    </button>
                    <button
                      onClick={() => setShowUserModal(true)}
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-xs sm:text-sm w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Usuário
                    </button>
                  </div>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {(() => {
                    const usersByType = users.reduce(
                      (acc, user) => {
                        let type = "Mesa"
                        if (user.is_admin) type = "Administrador"
                        else if (user.is_employee) type = "Funcionário"

                        if (!acc[type]) acc[type] = []
                        acc[type].push(user)
                        return acc
                      },
                      {} as Record<string, typeof users>,
                    )

                    return Object.entries(usersByType)
                      .sort(([typeA], [typeB]) => {
                        const order = { Cliente: 0, Funcionário: 1, Admin: 2 }
                        return (
                          (order[typeA as keyof typeof order] || 3) -
                          (order[typeB as keyof typeof order] || 3)
                        )
                      })
                      .map(([type, typeUsers]) => (
                        <div
                          key={type}
                          className="border rounded-lg bg-gray-50"
                        >
                          <button
                            onClick={() => toggleUserAccordion(type)}
                            className="w-full text-left p-3 sm:p-4 font-bold text-base sm:text-lg text-black hover:bg-gray-100 transition flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              {type}
                              <span className="bg-black text-white text-xs px-2 py-1 rounded-full">
                                {typeUsers.length}
                              </span>
                            </span>
                            <ChevronDown
                              className={`w-5 h-5 transition-transform ${expandedUsers.has(type) ? "rotate-180" : ""}`}
                            />
                          </button>
                          {expandedUsers.has(type) && (
                            <div className="p-3 sm:p-4">
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-black">
                                        Usuário
                                      </th>
                                      {type === "Mesa" ? (
                                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-black hidden sm:table-cell">
                                          Situação
                                        </th>
                                      ) : (
                                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-black hidden sm:table-cell">
                                          Telefone
                                        </th>
                                      )}
                                      {type === "Mesa" ? (
                                        <>
                                          <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-black hidden md:table-cell">
                                            Pedidos
                                          </th>
                                          <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-black hidden md:table-cell">
                                            Valor total
                                          </th>
                                        </>
                                      ) : (
                                        <>
                                          <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-black hidden md:table-cell">
                                            Admin
                                          </th>
                                          <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-black hidden md:table-cell">
                                            Func
                                          </th>
                                        </>
                                      )}
                                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-black">
                                        Ações
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {typeUsers
                                      .slice()
                                      .sort(compareUsernames)
                                      .map((user) => {
                                        const isOccupied =
                                          activeSessions.includes(user.username)
                                        const mesaOrders = orders.filter(
                                          (order) => order.user_id === user.id,
                                        )
                                        const mesaOrdersCount =
                                          mesaOrders.length
                                        const mesaTotal = mesaOrders.reduce(
                                          (sum, order) =>
                                            sum + (order.total || 0),
                                          0,
                                        )

                                        return (
                                          <tr
                                            key={user.id}
                                            className="border-b hover:bg-gray-100"
                                          >
                                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-black text-xs sm:text-sm">
                                              <div className="truncate">
                                                {user.username}
                                              </div>
                                              <div className="text-gray-600 text-xs sm:hidden">
                                                {type === "Mesa" ? (
                                                  <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                      isOccupied
                                                        ? "bg-red-100 text-red-800"
                                                        : "bg-green-100 text-green-800"
                                                    }`}
                                                  >
                                                    {isOccupied
                                                      ? "Ocupada"
                                                      : "Livre"}
                                                  </span>
                                                ) : user.phone &&
                                                  !/^0+$/.test(user.phone) ? (
                                                  user.phone
                                                ) : (
                                                  "-"
                                                )}
                                              </div>
                                            </td>
                                            {type === "Mesa" ? (
                                              <td className="px-2 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
                                                <span
                                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    isOccupied
                                                      ? "bg-red-100 text-red-800"
                                                      : "bg-green-100 text-green-800"
                                                  }`}
                                                >
                                                  {isOccupied
                                                    ? "Ocupada"
                                                    : "Livre"}
                                                </span>
                                              </td>
                                            ) : (
                                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-600 hidden sm:table-cell">
                                                {user.phone &&
                                                !/^0+$/.test(user.phone)
                                                  ? user.phone
                                                  : "-"}
                                              </td>
                                            )}
                                            {type === "Mesa" ? (
                                              <>
                                                <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell text-gray-700">
                                                  {mesaOrdersCount}
                                                </td>
                                                <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell text-gray-700">
                                                  R$ {mesaTotal.toFixed(2)}
                                                </td>
                                              </>
                                            ) : (
                                              <>
                                                <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                                                  <span
                                                    className={`px-2 py-1 rounded text-xs font-semibold ${
                                                      user.is_admin
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-gray-100 text-gray-800"
                                                    }`}
                                                  >
                                                    {user.is_admin
                                                      ? "Sim"
                                                      : "Não"}
                                                  </span>
                                                </td>
                                                <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                                                  <span
                                                    className={`px-2 py-1 rounded text-xs font-semibold ${
                                                      user.is_employee
                                                        ? "bg-blue-100 text-blue-800"
                                                        : "bg-gray-100 text-gray-800"
                                                    }`}
                                                  >
                                                    {user.is_employee
                                                      ? "Sim"
                                                      : "Não"}
                                                  </span>
                                                </td>
                                              </>
                                            )}
                                            <td className="px-2 sm:px-4 py-2 sm:py-3">
                                              <div className="flex gap-1 justify-center flex-wrap">
                                                {type !== "Mesa" && (
                                                  <>
                                                    <button
                                                      onClick={() =>
                                                        handleToggleAdmin(
                                                          user.id,
                                                          user.is_admin,
                                                        )
                                                      }
                                                      className="px-2 sm:px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition text-xs flex-1 min-w-20"
                                                      title="Gerenciar permissão de admin"
                                                    >
                                                      {user.is_admin
                                                        ? "Remover Admin"
                                                        : "Tornar Admin"}
                                                    </button>
                                                  </>
                                                )}
                                                <button
                                                  onClick={() =>
                                                    handleDeleteUser(user.id)
                                                  }
                                                  className="px-2 sm:px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs"
                                                >
                                                  <Trash2 className="w-3 h-3 inline" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                  })()}
                </div>
              </div>
            )}

            {activeTab === "performance" && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">
                  Performance dos Funcionários
                </h2>
                {employeePerformance.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500">
                    Nenhum funcionário encontrado ou sem dados de performance
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-black">
                              Funcionário
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-black">
                              Finalizados
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-black">
                              Cancelados
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-black">
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeePerformance.map((emp) => (
                            <tr
                              key={emp.userId}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-black font-semibold">
                                {emp.username}
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                                <span
                                  onClick={() =>
                                    handleViewCompletedOrders(emp.userId)
                                  }
                                  className="bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:bg-green-200 transition inline-block"
                                >
                                  {emp.completedOrders}
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                                <span
                                  onClick={() =>
                                    handleViewCancelledOrders(emp.userId)
                                  }
                                  className="bg-red-100 text-red-800 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:bg-red-200 transition inline-block"
                                >
                                  {emp.cancelledOrders}
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-black font-bold">
                                <span className="text-sm sm:text-lg">
                                  R$ {emp.totalRevenue.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumo Geral */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                      <div className="bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200">
                        <p className="text-xs sm:text-sm text-gray-600">
                          Finalizados
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1">
                          {employeePerformance.reduce(
                            (sum, emp) => sum + emp.completedOrders,
                            0,
                          )}
                        </p>
                      </div>
                      <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
                        <p className="text-xs sm:text-sm text-gray-600">
                          Cancelados
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-1">
                          {employeePerformance.reduce(
                            (sum, emp) => sum + emp.cancelledOrders,
                            0,
                          )}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-3 sm:p-4 rounded-lg border border-purple-200">
                        <p className="text-xs sm:text-sm text-gray-600">
                          Valor Total
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-purple-600 mt-1">
                          R${" "}
                          {employeePerformance
                            .reduce((sum, emp) => sum + emp.totalRevenue, 0)
                            .toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Exibir pedidos finalizados do funcionário selecionado */}
                    {selectedEmployeeForCompleted &&
                      selectedEmployeeCompletedOrders.length > 0 && (
                        <div className="p-4 sm:p-6 bg-green-50 rounded-lg border border-green-200 mb-6">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm sm:text-lg font-bold text-green-800">
                              Finalizados -{" "}
                              {
                                employeePerformance.find(
                                  (emp) =>
                                    emp.userId === selectedEmployeeForCompleted,
                                )?.username
                              }
                            </h3>
                            <button
                              onClick={() =>
                                setSelectedEmployeeForCompleted(null)
                              }
                              className="text-green-600 hover:text-green-800 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            {selectedEmployeeCompletedOrders.map((order) => (
                              <div
                                key={order.id}
                                className="bg-white p-2 sm:p-3 rounded border border-green-200 text-xs sm:text-sm"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold">
                                    Pedido #{order.id.substring(0, 8)}
                                  </span>
                                  <span className="text-gray-600">
                                    {new Date(order.created_at).toLocaleString(
                                      "pt-BR",
                                      {
                                        month: "2-digit",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </span>
                                </div>
                                <p className="text-gray-700 mt-1">
                                  <strong>Total:</strong> R${" "}
                                  {order.total.toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Exibir pedidos cancelados do funcionário selecionado */}
                    {selectedEmployeeForCancelled &&
                      selectedEmployeeCancelledOrders.length > 0 && (
                        <div className="p-4 sm:p-6 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm sm:text-lg font-bold text-red-800">
                              Cancelados -{" "}
                              {
                                employeePerformance.find(
                                  (emp) =>
                                    emp.userId === selectedEmployeeForCancelled,
                                )?.username
                              }
                            </h3>
                            <button
                              onClick={() =>
                                setSelectedEmployeeForCancelled(null)
                              }
                              className="text-red-600 hover:text-red-800 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            {selectedEmployeeCancelledOrders.map((order) => (
                              <div
                                key={order.id}
                                className="bg-white p-2 sm:p-3 rounded border border-red-200 text-xs sm:text-sm"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold">
                                    Pedido #{order.id.substring(0, 8)}
                                  </span>
                                  <span className="text-gray-600">
                                    {new Date(order.created_at).toLocaleString(
                                      "pt-BR",
                                      {
                                        month: "2-digit",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </span>
                                </div>
                                <p className="text-gray-700 mt-1">
                                  <strong>Total:</strong> R${" "}
                                  {order.total.toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showMenuModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => {
            setShowMenuModal(false)
            setEditingItem(null)
            setFormData({
              name: "",
              description: "",
              price: "",
              image_url: "",
              category: "hamburguer",
              newCategory: "",
            })
          }}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-2xl font-bold text-black">
                {editingItem ? "Editar Item" : "Adicionar Item"}
              </h2>
              <button
                onClick={() => {
                  setShowMenuModal(false)
                  setEditingItem(null)
                  setFormData({
                    name: "",
                    description: "",
                    price: "",
                    image_url: "",
                    category: "hamburguer",
                    newCategory: "",
                  })
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                    disabled={!!formData.newCategory}
                    required={!formData.newCategory}
                  >
                    <option value="">Selecione uma categoria</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {capitalize(cat)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Ou criar nova categoria (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.newCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, newCategory: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                    placeholder="Digite o nome da nova categoria"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Preço
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Imagem do Item
                  </label>
                  <label
                    htmlFor="menu-item-image"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleImageSelection(e.dataTransfer.files?.[0])
                    }}
                    className="group w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center cursor-pointer transition hover:border-black hover:bg-white"
                  >
                    <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-lg">
                      +
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-700">
                      Arraste e solte a imagem aqui
                    </div>
                    <div className="text-xs text-gray-500">
                      ou clique para selecionar
                    </div>
                    {imageFile && (
                      <div className="mt-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1">
                        {imageFile.name}
                      </div>
                    )}
                    <input
                      id="menu-item-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageSelection(e.target.files?.[0])
                      }
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Formatos aceitos: JPG, PNG, WEBP. Máx: 5MB.
                  </p>
                </div>

                {(imagePreview || formData.image_url) && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Preview
                    </label>
                    <div className="w-24 sm:w-32 h-24 sm:h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                      <img
                        src={imagePreview || formData.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t flex-shrink-0">
              <button
                type="submit"
                onClick={handleSaveMenuItem}
                className="w-full bg-black text-white py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition text-sm sm:text-base"
              >
                {editingItem ? "Atualizar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => {
            setShowUserModal(false)
            setUserFormData({
              username: "",
              phone: "",
              password: "",
              is_admin: false,
              is_employee: false,
            })
          }}
        >
          <div
            className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-2xl font-bold text-black">
                Adicionar Usuário
              </h2>
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setUserFormData({
                    username: "",
                    phone: "",
                    password: "",
                    is_admin: false,
                    is_employee: false,
                  })
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-4">
                {/* Tipo de Usuário - PRIMEIRO */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Tipo de Usuário
                  </label>
                  <select
                    value={
                      userFormData.is_admin
                        ? "admin"
                        : userFormData.is_employee
                          ? "employee"
                          : "cliente"
                    }
                    onChange={(e) => {
                      if (e.target.value === "admin") {
                        setUserFormData({
                          ...userFormData,
                          is_admin: true,
                          is_employee: false,
                        })
                      } else if (e.target.value === "employee") {
                        setUserFormData({
                          ...userFormData,
                          is_admin: false,
                          is_employee: true,
                        })
                      } else {
                        setUserFormData({
                          ...userFormData,
                          is_admin: false,
                          is_employee: false,
                        })
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                    required
                  >
                    <option value="cliente">Mesa</option>
                    <option value="employee">Funcionário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {/* Campos para CLIENTE */}
                {!userFormData.is_admin && !userFormData.is_employee && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Número da Mesa
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={userFormData.username}
                      onChange={(e) => {
                        const value = e.target.value
                        const numValue = parseInt(value, 10)

                        if (
                          !isNaN(numValue) &&
                          numValue >= 1 &&
                          numValue <= 9
                        ) {
                          // Números 1-9 viram 01-09
                          setUserFormData({
                            ...userFormData,
                            username: `0${numValue}`,
                          })
                        } else if (
                          !isNaN(numValue) &&
                          numValue >= 10 &&
                          numValue <= 99
                        ) {
                          // Números 10-99 ficam como estão
                          setUserFormData({
                            ...userFormData,
                            username: numValue.toString(),
                          })
                        } else if (numValue > 99) {
                          // Limita ao máximo de 99
                          setUserFormData({
                            ...userFormData,
                            username: "99",
                          })
                        } else {
                          // Campo vazio ou inválido
                          setUserFormData({
                            ...userFormData,
                            username: value,
                          })
                        }
                      }}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                      required
                    />
                  </div>
                )}

                {/* Campos para FUNCIONÁRIO E ADMIN */}
                {(userFormData.is_admin || userFormData.is_employee) && (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={userFormData.username}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            username: e.target.value,
                          })
                        }
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        value={userFormData.phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "")
                          setUserFormData({
                            ...userFormData,
                            phone: value,
                          })
                        }}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Senha
                      </label>
                      <input
                        type="password"
                        value={userFormData.password}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            password: e.target.value,
                          })
                        }
                        autoComplete="new-password"
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Mínimo 8 caracteres, com letra maiúscula e caractere
                        especial (!@#$%^&* etc.)
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 sm:p-6 border-t flex-shrink-0">
                <button
                  type="submit"
                  className="w-full bg-black text-white py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition text-sm sm:text-base"
                >
                  Adicionar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryReorderModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => setShowCategoryReorderModal(false)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-2xl font-bold text-black">
                Reordenar Categorias
              </h2>
              <button
                onClick={() => setShowCategoryReorderModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-2">
                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                  Use os botões para reordenar as categorias conforme desejado
                </p>
                {orderedCategories.map((category, index) => (
                  <div
                    key={category}
                    className="flex items-center justify-between p-3 sm:p-4 bg-gray-100 rounded-lg"
                  >
                    <span className="font-medium text-gray-800 text-sm">
                      {index + 1}.{" "}
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </span>
                    <div className="flex gap-1 sm:gap-2">
                      <button
                        onClick={() => handleMoveCategoryUp(index)}
                        disabled={index === 0}
                        className="p-1 sm:p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveCategoryDown(index)}
                        disabled={index === orderedCategories.length - 1}
                        className="p-1 sm:p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t flex-shrink-0 flex gap-2">
              <button
                onClick={() => setShowCategoryReorderModal(false)}
                className="flex-1 bg-gray-300 text-gray-800 py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-400 transition text-sm sm:text-base"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCategoryOrder}
                className="flex-1 bg-blue-600 text-white py-2 sm:py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-sm sm:text-base"
              >
                Salvar Ordem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Solicitações Pendentes */}
      {showPendingRequestsModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowPendingRequestsModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl sm:text-2xl font-bold text-black">
                Solicitações Pendentes
              </h2>
              <button
                onClick={() => setShowPendingRequestsModal(false)}
                className="text-gray-500 hover:text-gray-700 transition"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {pendingUsers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm sm:text-base">
                    Nenhuma solicitação pendente no momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingUsers.map((user) => (
                    <div
                      key={user.id}
                      className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-black">
                            {user.username}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Tipo de conta:{" "}
                            <span className="font-semibold text-black">
                              {user.is_admin
                                ? "Administrador"
                                : user.is_employee
                                  ? "Funcionário"
                                  : "Cliente"}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Solicitado em:{" "}
                            {new Date(user.created_at || "").toLocaleString(
                              "pt-BR",
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2 sm:flex-col">
                          <button
                            onClick={() => handleApproveUser(user.id)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold"
                          >
                            <Check className="w-4 h-4" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Deseja realmente recusar a solicitação de ${user.username}?`,
                                )
                              ) {
                                handleRejectUser(user.id)
                              }
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                          >
                            <X className="w-4 h-4" />
                            Recusar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t flex-shrink-0">
              <button
                onClick={() => setShowPendingRequestsModal(false)}
                className="w-full bg-gray-300 text-gray-800 py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-400 transition text-sm sm:text-base"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
