import "dotenv/config"
import express from "express"
import cors from "cors"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
  )
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const app = express()
app.use(cors())
app.use(express.json())

const isBcryptHash = (value) => /^\$2[aby]\$/.test(value || "")

const maybeUpgradePasswordHash = async (userId, plain, stored) => {
  if (!stored || isBcryptHash(stored) || plain !== stored) return
  const nextHash = bcrypt.hashSync(plain, 10)
  await supabase
    .from("users")
    .update({ password_hash: nextHash })
    .eq("id", userId)
}

const generateSlug = (username) => {
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

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, isEmployee } = req.body || {}

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
})

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, phone, password, adminUsername, adminPassword } =
      req.body || {}

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
})

app.post("/api/auth/request-registration", async (req, res) => {
  try {
    const { username, phone, password, userType } = req.body || {}

    if (
      !username ||
      !password ||
      (userType !== "admin" && userType !== "employee")
    ) {
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
      is_admin: userType === "admin",
      is_employee: userType === "employee",
      approval_status: "pending",
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
})

app.post("/api/admin/create-user", async (req, res) => {
  try {
    const { username, phone, password, is_admin, is_employee } = req.body || {}

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
})

const port = process.env.PORT || 3001
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Auth server listening on port ${port}`)
})
