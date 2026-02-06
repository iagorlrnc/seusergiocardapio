import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import EmployeeLogin from "./pages/EmployeeLogin";
import CustomerOrder from "./pages/CustomerOrder";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AppContent() {
  const { user, loading, loginBySlug } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showEmployeeLogin, setShowEmployeeLogin] = useState(false);
  const navigate = useNavigate();
  const { userSlug } = useParams();

  useEffect(() => {
    if (!loading) {
      if (user && !userSlug) {
        // Se usuário está logado mas a URL não tem slug, redirecionar
        navigate(`/${user.slug}`, { replace: true });
      } else if (!user && userSlug) {
        // Se usuário não está logado mas há slug na URL, verificar localStorage
        // Se há dados no localStorage, é um reload/refresh - fazer login automático
        // Se não há, é um logout ou acesso novo - redirecionar para home
        const storedUser = localStorage.getItem("allblack_user");
        if (storedUser) {
          // É um reload/refresh, faz login automático
          (async () => {
            await loginBySlug(userSlug, true);
          })();
        } else {
          // É um logout ou acesso novo sem autenticação anterior
          // Redirecionar para home para evitar race condition
          navigate("/", { replace: true });
        }
      }
    }
  }, [user, userSlug, navigate, loading, loginBySlug]);

  if (loading || (!user && userSlug)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    if (showEmployeeLogin) {
      return (
        <EmployeeLogin
          onSwitchToLogin={() => setShowEmployeeLogin(false)}
          onSwitchToAdmin={() => {
            setShowEmployeeLogin(false);
            setShowAdminLogin(true);
          }}
        />
      );
    }

    if (showAdminLogin) {
      return (
        <AdminLogin
          onSwitchToLogin={() => setShowAdminLogin(false)}
          onSwitchToEmployee={() => {
            setShowAdminLogin(false);
            setShowEmployeeLogin(true);
          }}
        />
      );
    }

    return (
      <Login
        onSwitchToRegister={() => setShowAdminLogin(true)}
        onSwitchToEmployee={() => setShowEmployeeLogin(true)}
      />
    );
  }

  if (user.is_admin) {
    return <AdminDashboard />;
  }

  if (user.is_employee) {
    return <EmployeeDashboard />;
  }

  return <CustomerOrder />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </AuthProvider>
  );
}

export default App;
