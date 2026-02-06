DROP TABLE IF EXISTS waiter_calls CASCADE;
DROP TABLE IF EXISTS category_order CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE,
  phone text NOT NULL,
  password_hash text NOT NULL,
  is_admin boolean DEFAULT false,
  is_employee boolean DEFAULT false,
  qr_code text UNIQUE,
  slug text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL,
  price decimal(10,2) NOT NULL,
  image_url text NOT NULL,
  category text NOT NULL DEFAULT 'hamburguer',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending',
  total decimal(10,2) DEFAULT 0,
  payment_method text,
  observations text,
  hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id),
  quantity integer NOT NULL,
  price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username text NOT NULL,
  login_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE category_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE waiter_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  UNIQUE(id)
);

CREATE INDEX idx_users_is_admin ON users(is_admin);
CREATE INDEX idx_users_is_employee ON users(is_employee);
CREATE INDEX idx_users_roles ON users(is_admin, is_employee);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_qr_code ON users(qr_code);
CREATE INDEX idx_users_slug ON users(slug);

CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_active ON menu_items(active);
CREATE INDEX idx_menu_items_category_active ON menu_items(category, active);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_assigned_to ON orders(assigned_to);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_hidden ON orders(hidden);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_assigned_status ON orders(assigned_to, status);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);

CREATE INDEX idx_active_sessions_username ON active_sessions(username);
CREATE INDEX idx_active_sessions_user_id ON active_sessions(user_id);

CREATE INDEX idx_category_order_position ON category_order(position);

CREATE INDEX waiter_calls_user_id_idx ON waiter_calls(user_id);
CREATE INDEX waiter_calls_status_idx ON waiter_calls(status);
CREATE INDEX waiter_calls_created_at_idx ON waiter_calls(created_at DESC);

CREATE OR REPLACE FUNCTION generate_user_qr_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_admin = false AND NEW.is_employee = false THEN
    NEW.qr_code := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_user_qr_code
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION generate_user_qr_code();

CREATE OR REPLACE FUNCTION update_category_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_category_order_timestamp
  BEFORE UPDATE ON category_order
  FOR EACH ROW
  EXECUTE FUNCTION update_category_order_timestamp();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to users"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to users"
  ON users FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access to users"
  ON users FOR DELETE
  USING (true);

CREATE POLICY "Public read access to menu_items"
  ON menu_items FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to menu_items"
  ON menu_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to menu_items"
  ON menu_items FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access to menu_items"
  ON menu_items FOR DELETE
  USING (true);

CREATE POLICY "Public read access to orders"
  ON orders FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to orders"
  ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to orders"
  ON orders FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access to orders"
  ON orders FOR DELETE
  USING (true);

CREATE POLICY "Public read access to order_items"
  ON order_items FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to order_items"
  ON order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to order_items"
  ON order_items FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access to order_items"
  ON order_items FOR DELETE
  USING (true);

CREATE POLICY "Public read access to active_sessions"
  ON active_sessions FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to active_sessions"
  ON active_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to active_sessions"
  ON active_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access to active_sessions"
  ON active_sessions FOR DELETE
  USING (true);

CREATE POLICY "Public read access to category_order"
  ON category_order FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to category_order"
  ON category_order FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to category_order"
  ON category_order FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access to category_order"
  ON category_order FOR DELETE
  USING (true);

CREATE POLICY "Public read access to waiter_calls"
  ON waiter_calls FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to waiter_calls"
  ON waiter_calls FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to waiter_calls"
  ON waiter_calls FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access to waiter_calls"
  ON waiter_calls FOR DELETE
  USING (true);

INSERT INTO users (username, email, phone, password_hash, is_admin, is_employee, slug)
VALUES
  ('01', '01@cardapio.com', '0000000000', '123456', false, false, '01'),
  ('funcionario', 'funcionario@cardapio.com', '0000000000', 'func123', false, true, 'funcionario'),
  ('iagor', 'iagor@cardapio.com', '11999999999', '1234', false, true, 'joao'),
  ('admin', 'admin@cardapio.com', '0000000000', 'admin123', true, false, 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO menu_items (name, description, price, image_url, category, active)
VALUES
  ('Black Burger Clássico', 'Hambúrguer artesanal de 180g, queijo cheddar, alface, tomate, cebola roxa e molho especial da casa', 32.90, 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('All Black Bacon', 'Hambúrguer de 200g, bacon crocante, queijo suíço, cebola caramelizada e barbecue especial', 38.90, 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('Dark Cheddar', 'Duplo hambúrguer de 160g, duplo cheddar cremoso, picles e mostarda artesanal', 42.90, 'https://images.pexels.com/photos/580612/pexels-photo-580612.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('Black Monster', 'Triplo hambúrguer de 150g, três fatias de queijo, bacon, ovo, alface, tomate e molho especial', 52.90, 'https://images.pexels.com/photos/1556688/pexels-photo-1556688.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('Veggie Black', 'Hambúrguer vegetariano de grão de bico, queijo vegano, rúcula, tomate seco e maionese de ervas', 29.90, 'https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('BBQ Black', 'Hambúrguer de 200g, onion rings, queijo prato, bacon e generoso molho barbecue', 39.90, 'https://images.pexels.com/photos/2725744/pexels-photo-2725744.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('Spicy Black', 'Hambúrguer apimentado com jalapeños, queijo pepper jack, cebola crispy e molho picante', 36.90, 'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('Truffle Black', 'Hambúrguer premium com trufa, queijo brie, rúcula fresca e redução de vinho tinto', 48.90, 'https://images.pexels.com/photos/3616956/pexels-photo-3616956.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('Blue Cheese Black', 'Hambúrguer com gorgonzola, nozes caramelizadas, pera grelhada e mel trufado', 44.90, 'https://images.pexels.com/photos/2983102/pexels-photo-2983102.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),
  ('Mushroom Swiss', 'Hambúrguer com cogumelos salteados, queijo suíço derretido e molho de ervas', 37.90, 'https://images.pexels.com/photos/3616957/pexels-photo-3616957.jpeg?auto=compress&cs=tinysrgb&w=800', 'hamburguer', true),

  ('Coca-Cola 350ml', 'Refrigerante Coca-Cola tradicional gelado', 5.90, 'https://images.pexels.com/photos/2775860/pexels-photo-2775860.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Coca-Cola Zero 350ml', 'Refrigerante Coca-Cola Zero, zero calorias', 5.90, 'https://images.pexels.com/photos/2775860/pexels-photo-2775860.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Guaraná Antarctica 350ml', 'Refrigerante Guaraná Antarctica gelado', 5.50, 'https://images.pexels.com/photos/230588/pexels-photo-230588.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Suco Natural de Laranja 300ml', 'Suco natural de laranja fresca espremida na hora', 8.90, 'https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Suco Natural de Abacaxi 300ml', 'Suco natural de abacaxi fresco espremido na hora', 8.90, 'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Água Mineral 500ml', 'Água mineral natural sem gás', 3.50, 'https://images.pexels.com/photos/327090/pexels-photo-327090.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Água com Gás 500ml', 'Água mineral com gás', 4.00, 'https://images.pexels.com/photos/327090/pexels-photo-327090.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Cerveja Brahma 600ml', 'Cerveja Brahma puro malte, refrescante e leve', 12.90, 'https://images.pexels.com/photos/1552630/pexels-photo-1552630.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Cerveja Stella Artois 330ml', 'Cerveja belga premium, sabor único e sofisticado', 15.90, 'https://images.pexels.com/photos/247478/pexels-photo-247478.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Milkshake de Chocolate 400ml', 'Milkshake cremoso de chocolate belga com chantilly', 14.90, 'https://images.pexels.com/photos/372725/pexels-photo-372725.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Milkshake de Morango 400ml', 'Milkshake cremoso de morango fresco com chantilly', 14.90, 'https://images.pexels.com/photos/372725/pexels-photo-372725.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),
  ('Milkshake de Baunilha 400ml', 'Milkshake cremoso de baunilha com chantilly', 14.90, 'https://images.pexels.com/photos/372725/pexels-photo-372725.jpeg?auto=compress&cs=tinysrgb&w=800', 'bebidas', true),

  ('Batata Frita Tradicional', 'Porção de batatas fritas crocantes, saladas e sequinhas', 16.90, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=800', 'acompanhamento', true),
  ('Batata Frita com Cheddar e Bacon', 'Batatas fritas cobertas com cheddar derretido e bacon crocante', 22.90, 'https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg?auto=compress&cs=tinysrgb&w=800', 'acompanhamento', true),
  ('Onion Rings', 'Anéis de cebola empanados e fritos, crocantes por fora e macios por dentro', 18.90, 'https://images.pexels.com/photos/1359326/pexels-photo-1359326.jpeg?auto=compress&cs=tinysrgb&w=800', 'acompanhamento', true),
  ('Nuggets de Frango (8 unidades)', 'Nuggets de frango empanados e fritos, servidos com molho barbecue', 19.90, 'https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg?auto=compress&cs=tinysrgb&w=800', 'acompanhamento', true),
  ('Salada Caesar', 'Mix de folhas verdes, croutons, queijo parmesão e molho caesar', 15.90, 'https://images.pexels.com/photos/1211887/pexels-photo-1211887.jpeg?auto=compress&cs=tinysrgb&w=800', 'acompanhamento', true),
  ('Mandioca Frita', 'Porção de mandioca frita crocante e sequinha', 14.90, 'https://images.pexels.com/photos/1707913/pexels-photo-1707913.jpeg?auto=compress&cs=tinysrgb&w=800', 'acompanhamento', true),
  ('Polenta Frita', 'Porção de polenta frita dourada e crocante', 16.90, 'https://images.pexels.com/photos/6287519/pexels-photo-6287519.jpeg?auto=compress&cs=tinysrgb&w=800', 'acompanhamento', true),

  ('Bolinho de Bacalhau (6 unidades)', 'Bolinhos de bacalhau com cebola, salsinha e azeite, fritos até ficarem dourados', 24.90, 'https://images.pexels.com/photos/1893590/pexels-photo-1893590.jpeg?auto=compress&cs=tinysrgb&w=800', 'entrada', true),
  ('Coxinha de Frango (4 unidades)', 'Coxinhas de frango com catupiry, empanadas e fritas', 18.90, 'https://images.pexels.com/photos/1893570/pexels-photo-1893570.jpeg?auto=compress&cs=tinysrgb&w=800', 'entrada', true),
  ('Pastel de Carne (4 unidades)', 'Pastéis de carne moída com cebola, azeitona e temperos especiais', 16.90, 'https://images.pexels.com/photos/1893569/pexels-photo-1893569.jpeg?auto=compress&cs=tinysrgb&w=800', 'entrada', true),
  ('Queijo Coalho na Brasa', 'Espetinhos de queijo coalho grelhados na brasa, servidos com mel e orégano', 22.90, 'https://images.pexels.com/photos/6287518/pexels-photo-6287518.jpeg?auto=compress&cs=tinysrgb&w=800', 'entrada', true),
  ('Pão de Alho', 'Pão francês com manteiga de alho, gratinado e crocante', 12.90, 'https://images.pexels.com/photos/1893589/pexels-photo-1893589.jpeg?auto=compress&cs=tinysrgb&w=800', 'entrada', true),

  ('Torta de Chocolate', 'Torta de chocolate meio amargo com calda quente e sorvete de creme', 16.90, 'https://images.pexels.com/photos/2144112/pexels-photo-2144112.jpeg?auto=compress&cs=tinysrgb&w=800', 'sobremesa', true),
  ('Petit Gateau', 'Bolinho de chocolate com recheio cremoso, servido quente com sorvete', 18.90, 'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress&cs=tinysrgb&w=800', 'sobremesa', true),
  ('Sorvete Sundae', 'Taça de sorvete de baunilha com calda de chocolate, chantilly e nozes', 14.90, 'https://images.pexels.com/photos/1352278/pexels-photo-1352278.jpeg?auto=compress&cs=tinysrgb&w=800', 'sobremesa', true),
  ('Tiramisu', 'Clássico italiano com biscoitos champagne, café, mascarpone e cacau', 19.90, 'https://images.pexels.com/photos/2144202/pexels-photo-2144202.jpeg?auto=compress&cs=tinysrgb&w=800', 'sobremesa', true),
  ('Cheesecake de Frutas Vermelhas', 'Cheesecake cremoso com cobertura de frutas vermelhas frescas', 17.90, 'https://images.pexels.com/photos/2144210/pexels-photo-2144210.jpeg?auto=compress&cs=tinysrgb&w=800', 'sobremesa', true),
  ('Brownie com Sorvete', 'Brownie de chocolate quentinho com bola de sorvete de baunilha', 15.90, 'https://images.pexels.com/photos/2144201/pexels-photo-2144201.jpeg?auto=compress&cs=tinysrgb&w=800', 'sobremesa', true)

ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  image_url = EXCLUDED.image_url,
  active = EXCLUDED.active,
  updated_at = now();

UPDATE users SET slug = lower(regexp_replace(username, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

UPDATE users
SET qr_code = gen_random_uuid()::text
WHERE qr_code IS NULL
  AND is_admin = false
  AND is_employee = false;

COMMENT ON TABLE users IS 'Usuários do sistema (clientes, funcionários e administradores)';
COMMENT ON TABLE menu_items IS 'Itens do cardápio disponíveis para pedidos';
COMMENT ON TABLE orders IS 'Pedidos realizados pelos clientes';
COMMENT ON TABLE order_items IS 'Itens individuais de cada pedido';
COMMENT ON TABLE active_sessions IS 'Sessões ativas de usuários (mesas ocupadas)';
COMMENT ON TABLE category_order IS 'Ordem de exibição das categorias no cardápio';
COMMENT ON TABLE waiter_calls IS 'Chamadas de garçom feitas pelos clientes';