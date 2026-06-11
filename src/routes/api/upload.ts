import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { asc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { parts, workFiles, works } from '../../db/schema'
import { newId } from '../../lib/id'
import { guessPartFromFilename, isAudioFilename } from '../../lib/taxonomy'
import { currentUser, hasPermission } from '../../server/access'
import { countPdfPages } from '../../server/pdf'

/**
 * Multi-filopplasting for et verk. Tar imot FormData med `workId` + `files`,
 * gjetter stemme fra filnavnet og lagrer i R2.
 */
export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const me = await currentUser()
        if (!me || !hasPermission(me, 'works.manage')) {
          return Response.json({ error: 'Krever arkivar-tilgang' }, { status: 403 })
        }

        const form = await request.formData()
        const workId = form.get('workId')
        if (typeof workId !== 'string' || !workId) {
          return Response.json({ error: 'Mangler workId' }, { status: 400 })
        }

        const d = db()
        const work = (await d.select().from(works).where(eq(works.id, workId)).limit(1))[0]
        if (!work) return Response.json({ error: 'Fant ikke verket' }, { status: 404 })

        const partDefs = await d.select().from(parts).orderBy(asc(parts.sortOrder))

        const uploaded: Array<{
          id: string
          fileName: string
          kind: string
          partId: string | null
          partName: string | null
          pageCount: number | null
        }> = []

        for (const entry of form.getAll('files')) {
          if (!(entry instanceof File)) continue
          const fileName = entry.name
          const isPdf = /\.pdf$/i.test(fileName)
          const isAudio = isAudioFilename(fileName)
          if (!isPdf && !isAudio) continue
          if (entry.size > 50 * 1024 * 1024) continue

          const bytes = await entry.arrayBuffer()
          const guessed = isAudio ? null : guessPartFromFilename(fileName, partDefs)
          const kind = isAudio ? 'audio' : guessed === 'score' ? 'score' : guessed ? 'part' : 'other'
          const pageCount = isPdf ? await countPdfPages(bytes) : null

          const fileId = newId()
          const ext = isPdf ? 'pdf' : (fileName.split('.').pop() ?? 'bin').toLowerCase()
          const r2Key = `works/${workId}/${fileId}.${ext}`
          await env.FILES.put(r2Key, bytes)

          await d.insert(workFiles).values({
            id: fileId,
            workId,
            kind,
            partId: guessed,
            label: null,
            r2Key,
            fileName,
            fileSize: bytes.byteLength,
            pageCount,
            uploadedBy: me.id,
            uploadedAt: new Date(),
          })

          uploaded.push({
            id: fileId,
            fileName,
            kind,
            partId: guessed,
            partName: guessed ? (partDefs.find((p) => p.id === guessed)?.nameNo ?? null) : null,
            pageCount,
          })
        }

        await d.update(works).set({ updatedAt: new Date() }).where(eq(works.id, workId))

        return Response.json({ uploaded })
      },
    },
  },
})
