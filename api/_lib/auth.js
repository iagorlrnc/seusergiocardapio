import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { supabase } from "./supabase.js"

export const isBcryptHash = (value) => /^\$2[aby]\$/.test(value || "")

export const maybeUpgradePasswordHash = async (userId, plain, stored) => {
  if (!stored || isBcryptHash(stored) || plain !== stored) return
  const nextHash = bcrypt.hashSync(plain, 10)
  await supabase
    .from("users")
    .update({ password_hash: nextHash })
    .eq("id", userId)
}

export const generateSlug = (username) => {
  const base = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  const suffix = randomUUID().slice(0, 8)
  return base ? `${base}-${suffix}` : suffix
}

export const readJsonBody = (req) => {
  if (!req) return {}
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body || {}
}
