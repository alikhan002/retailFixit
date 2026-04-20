import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const client = postgres(connectionString, {
  max: parseInt(process.env.DATABASE_POOL_SIZE ?? '10'),
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
})

export const db = drizzle(client, { schema })
