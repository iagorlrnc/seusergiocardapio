import { z } from "zod";

// Schema para validação de senha forte
export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    "A senha deve conter pelo menos um caractere especial (!@#$%^&* etc.)",
  );

// Schema para cadastro de admin/funcionário
export const adminRegistrationSchema = z
  .object({
    username: z
      .string()
      .min(3, "Nome de usuário deve ter no mínimo 3 caracteres")
      .max(50, "Nome de usuário deve ter no máximo 50 caracteres"),
    phone: z
      .string()
      .min(10, "Telefone é obrigatório")
      .regex(/^\d+$/, "Telefone deve conter apenas números"),
    password: passwordSchema,
    confirmPassword: z.string(),
    userType: z.enum(["admin", "employee"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

// Schema para login
export const loginSchema = z.object({
  username: z.string().min(1, "Nome de usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});
