import { NextResponse } from "next/server"
import { Pool } from "pg"

export async function GET() {
  const info: Record<string, unknown> = {
    env_database_url: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : "NOT SET",
    env_auth_secret: process.env.AUTH_SECRET ? "SET" : "NOT SET",
    env_node_env: process.env.NODE_ENV,
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    })
    const result = await pool.query('SELECT count(*) as cnt FROM "User"')
    info.db_connection = "OK"
    info.user_count = result.rows[0].cnt
    await pool.end()
  } catch (e: any) {
    info.db_connection = "FAILED"
    info.db_error = e.message
  }

  return NextResponse.json(info)
}
