import { createServerFn } from '@tanstack/react-start'
import { currentUser } from './access'

/** Innlogget bruker (eller null) — brukes i __root beforeLoad. */
export const getMe = createServerFn().handler(async () => {
  return currentUser()
})
