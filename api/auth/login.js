import bcrypt from "bcryptjs"
import { supabase } from "../_lib/supabase.js"
import {
  isBcryptHash,
  maybeUpgradePasswordHash,
  readJsonBody,
} from "../_lib/auth.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" })
  }

  try {
    const { username, password, isEmployee } = readJsonBody(req)

    if (!username || typeof password !== "string") {
      return res.status(400).json({ success: false, error: "Invalid payload" })
    }

    let query = supabase
      .from("users")
      .select("id, username, phone, is_admin, is_employee, slug, password_hash")
      .eq("username", username)

    if (isEmployee) {
      query = query.eq("is_employee", true).eq("is_admin", false)
    } else {
      query = query.eq("is_admin", true)
    }

    const { data, error } = await query.maybeSingle()

    if (error || !data) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" })
    }

    const stored = data.password_hash || ""
    const valid = isBcryptHash(stored)
      ? bcrypt.compareSync(password, stored)
      : password === stored

    if (!valid) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" })
    }

    await maybeUpgradePasswordHash(data.id, password, stored)

    const user = {
      id: data.id,
      username: data.username,
      phone: data.phone,
      is_admin: data.is_admin,
      is_employee: data.is_employee,
      slug: data.slug,
    }

    return res.json({ success: true, user })
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error" })
  }
}
