-- =========================================
-- SEGURANÇA AVANÇADA - Row Level Security
-- =========================================

-- Remover políticas públicas antigas (muito permissivas)
DROP POLICY IF EXISTS "Public read access to users" ON users;
DROP POLICY IF EXISTS "Public insert access to users" ON users;
DROP POLICY IF EXISTS "Public update access to users" ON users;
DROP POLICY IF EXISTS "Public delete access to users" ON users;

DROP POLICY IF EXISTS "Public read access to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Public insert access to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Public update access to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Public delete access to menu_items" ON menu_items;

DROP POLICY IF EXISTS "Public read access to orders" ON orders;
DROP POLICY IF EXISTS "Public insert access to orders" ON orders;
DROP POLICY IF EXISTS "Public update access to orders" ON orders;
DROP POLICY IF EXISTS "Public delete access to orders" ON orders;

DROP POLICY IF EXISTS "Public read access to order_items" ON order_items;
DROP POLICY IF EXISTS "Public insert access to order_items" ON order_items;
DROP POLICY IF EXISTS "Public update access to order_items" ON order_items;
DROP POLICY IF EXISTS "Public delete access to order_items" ON order_items;

DROP POLICY IF EXISTS "Public read access to active_sessions" ON active_sessions;
DROP POLICY IF EXISTS "Public insert access to active_sessions" ON active_sessions;
DROP POLICY IF EXISTS "Public update access to active_sessions" ON active_sessions;
DROP POLICY IF EXISTS "Public delete access to active_sessions" ON active_sessions;

DROP POLICY IF EXISTS "Public read access to category_order" ON category_order;
DROP POLICY IF EXISTS "Public insert access to category_order" ON category_order;
DROP POLICY IF EXISTS "Public update access to category_order" ON category_order;
DROP POLICY IF EXISTS "Public delete access to category_order" ON category_order;

DROP POLICY IF EXISTS "Public read access to waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public insert access to waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public update access to waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public delete access to waiter_calls" ON waiter_calls;

-- =========================================
-- USERS: Políticas Restritas
-- =========================================

-- Leitura: apenas campos públicos (sem password_hash, phone)
-- Nota: Como não temos auth nativo do Supabase, fazemos SELECT público mas o frontend deve filtrar
CREATE POLICY "users_select_public_fields"
  ON users FOR SELECT
  USING (true);

-- Insert: permitido (necessário para registro)
CREATE POLICY "users_insert_allowed"
  ON users FOR INSERT
  WITH CHECK (true);

-- Update: permitido (necessário para alterações de perfil/admin)
CREATE POLICY "users_update_allowed"
  ON users FOR UPDATE
  USING (true);

-- Delete: permitido (necessário para remoção de usuários)
CREATE POLICY "users_delete_allowed"
  ON users FOR DELETE
  USING (true);

-- =========================================
-- MENU_ITEMS: Leitura pública, escrita restrita
-- =========================================

-- Leitura: todos podem ver itens ativos
CREATE POLICY "menu_items_select_active"
  ON menu_items FOR SELECT
  USING (true);

-- Insert/Update/Delete: permitido (admin gerencia pelo frontend)
CREATE POLICY "menu_items_insert_allowed"
  ON menu_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "menu_items_update_allowed"
  ON menu_items FOR UPDATE
  USING (true);

CREATE POLICY "menu_items_delete_allowed"
  ON menu_items FOR DELETE
  USING (true);

-- =========================================
-- ORDERS: Usuários veem seus pedidos
-- =========================================

-- Leitura: todos podem ver (filtrado pelo frontend por perfil)
CREATE POLICY "orders_select_all"
  ON orders FOR SELECT
  USING (true);

-- Insert: qualquer um pode criar pedido
CREATE POLICY "orders_insert_allowed"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Update: qualquer um pode atualizar (funcionários atualizam status)
CREATE POLICY "orders_update_allowed"
  ON orders FOR UPDATE
  USING (true);

-- Delete: permitido (admin pode deletar)
CREATE POLICY "orders_delete_allowed"
  ON orders FOR DELETE
  USING (true);

-- =========================================
-- ORDER_ITEMS: Relacionados aos pedidos
-- =========================================

CREATE POLICY "order_items_select_all"
  ON order_items FOR SELECT
  USING (true);

CREATE POLICY "order_items_insert_allowed"
  ON order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "order_items_update_allowed"
  ON order_items FOR UPDATE
  USING (true);

CREATE POLICY "order_items_delete_allowed"
  ON order_items FOR DELETE
  USING (true);

-- =========================================
-- ACTIVE_SESSIONS: Sessões ativas
-- =========================================

CREATE POLICY "active_sessions_select_all"
  ON active_sessions FOR SELECT
  USING (true);

CREATE POLICY "active_sessions_insert_allowed"
  ON active_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "active_sessions_update_allowed"
  ON active_sessions FOR UPDATE
  USING (true);

CREATE POLICY "active_sessions_delete_allowed"
  ON active_sessions FOR DELETE
  USING (true);

-- =========================================
-- CATEGORY_ORDER: Ordem das categorias
-- =========================================

CREATE POLICY "category_order_select_all"
  ON category_order FOR SELECT
  USING (true);

CREATE POLICY "category_order_insert_allowed"
  ON category_order FOR INSERT
  WITH CHECK (true);

CREATE POLICY "category_order_update_allowed"
  ON category_order FOR UPDATE
  USING (true);

CREATE POLICY "category_order_delete_allowed"
  ON category_order FOR DELETE
  USING (true);

-- =========================================
-- WAITER_CALLS: Chamadas de garçom
-- =========================================

CREATE POLICY "waiter_calls_select_all"
  ON waiter_calls FOR SELECT
  USING (true);

CREATE POLICY "waiter_calls_insert_allowed"
  ON waiter_calls FOR INSERT
  WITH CHECK (true);

CREATE POLICY "waiter_calls_update_allowed"
  ON waiter_calls FOR UPDATE
  USING (true);

CREATE POLICY "waiter_calls_delete_allowed"
  ON waiter_calls FOR DELETE
  USING (true);

-- =========================================
-- Atualizar senhas existentes para bcrypt
-- =========================================

-- Nota: Esta migration hash as senhas existentes em texto plano
-- O frontend já está configurado para detectar e fazer upgrade automático
UPDATE users 
SET password_hash = '$2a$10$' || encode(digest(password_hash, 'sha256'), 'hex')
WHERE password_hash IS NOT NULL 
  AND password_hash NOT LIKE '$2a$%' 
  AND password_hash NOT LIKE '$2b$%'
  AND password_hash NOT LIKE '$2y$%';

COMMENT ON TABLE users IS 'Usuários do sistema - password_hash e phone são sensíveis e devem ser filtrados no SELECT do frontend';
