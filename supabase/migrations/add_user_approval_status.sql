-- Adicionar campo de status de aprovação aos usuários
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Atualizar usuários existentes para 'approved'
UPDATE users SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Criar índice para facilitar busca de solicitações pendentes
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);

COMMENT ON COLUMN users.approval_status IS 'Status de aprovação do usuário: pending (aguardando aprovação), approved (aprovado), rejected (rejeitado)';
 