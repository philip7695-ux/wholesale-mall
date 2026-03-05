import { NextResponse } from "next/server"
import { Pool } from "pg"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const info: Record<string, unknown> = {
    env_database_url: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : "NOT SET",
    env_auth_secret: process.env.AUTH_SECRET ? "SET" : "NOT SET",
    env_node_env: process.env.NODE_ENV,
  }

  // Test 1: raw pg pool
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    })
    const result = await pool.query('SELECT count(*) as cnt FROM "User"')
    info.pg_connection = "OK"
    info.user_count = result.rows[0].cnt
    await pool.end()
  } catch (e: any) {
    info.pg_connection = "FAILED"
    info.pg_error = e.message
  }

  // Test 2: Prisma client
  try {
    const count = await prisma.user.count()
    info.prisma_connection = "OK"
    info.prisma_user_count = count
  } catch (e: any) {
    info.prisma_connection = "FAILED"
    info.prisma_error = e.message
  }

  // Test 3: Order count via Prisma
  try {
    const count = await prisma.order.count()
    info.prisma_order_count = count
  } catch (e: any) {
    info.prisma_order_error = e.message
  }

  // Test 4: auth() call
  try {
    const session = await auth()
    info.auth_result = session ? `OK (role: ${session.user?.role}, id: ${session.user?.id?.slice(0, 8)}...)` : "null (not logged in)"
  } catch (e: any) {
    info.auth_result = "FAILED"
    info.auth_error = e.message
    info.auth_stack = e.stack?.split("\n").slice(0, 3).join(" | ")
  }

  return NextResponse.json(info)
}
