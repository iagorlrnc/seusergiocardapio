import bcrypt from "bcryptjs"
import { supabase } from "../_lib/supabase.js"
import {
  isBcryptHash,
  maybeUpgradePasswordHash,
  generateSlug,
  readJsonBody,
} from "../_lib/auth.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" })
  }

  try {
    const { username, phone, password, adminUsername, adminPassword } =
      readJsonBody(req)

    if (!username || !password || !adminUsername || !adminPassword) {
      return res.status(400).json({ success: false, error: "Invalid payload" })
    }

    const { data: adminUser } = await supabase
      .from("users")
      .select("id, password_hash")
      .eq("username", adminUsername)
      .eq("is_admin", true)
      .maybeSingle()

    if (!adminUser) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" })
    }

    const adminStored = adminUser.password_hash || ""
    const adminValid = isBcryptHash(adminStored)
      ? bcrypt.compareSync(adminPassword, adminStored)
      : adminPassword === adminStored

    if (!adminValid) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" })
    }

    await maybeUpgradePasswordHash(adminUser.id, adminPassword, adminStored)

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
      is_admin: false,
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
