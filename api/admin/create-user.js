import bcrypt from "bcryptjs"
import { supabase } from "../_lib/supabase.js"
import { generateSlug, readJsonBody } from "../_lib/auth.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" })
  }

  try {
    const { username, phone, password, is_admin, is_employee } =
      readJsonBody(req)

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Invalid payload" })
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .maybeSingle()

    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, error: "User already exists" })
    }

    const hashedPassword = bcrypt.hashSync(password, 10)

    const { error } = await supabase.from("users").insert({
      username,
      phone,
      password_hash: hashedPassword,
      slug: generateSlug(username),
      is_admin: !!is_admin,
      is_employee: !!is_employee,
      approval_status: "approved",
    })

    if (error) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to create user" })
    }

    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error" })
  }
}
