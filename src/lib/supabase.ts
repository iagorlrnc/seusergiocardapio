import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  username: string;
  phone?: string;
  is_admin: boolean;
  is_employee?: boolean;
  slug: string;
  created_at?: string;
  approval_status?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  active: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  status: string;
  total: number;
  hidden: boolean;
  payment_method?: string;
  observations?: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  assigned_employee?: { username: string } | null;
  assignedEmployee?: { username: string } | null;
  users?: { username: string } | null;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price: number;
  menu_items?: MenuItem;
}

export interface CartItem extends MenuItem {
  quantity: number;
}
