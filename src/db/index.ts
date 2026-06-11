import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import * as schema from './schema'

export function db() {
  return drizzle(env.DB, { schema })
}

export type Db = ReturnType<typeof db>
export { schema }
