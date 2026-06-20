import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { downloadLog, projectWorks, shareLinks, workFiles } from '../../../db/schema'
import { newId, sha256Hex } from '../../../lib/id'
import { currentUser, hasPermission } from '../../../server/access'

function contentTypeFor(fileName: string): string {
  if (/\.pdf$/i.test(fileName)) return 'application/pdf'
  if (/\.mp3$/i.test(fileName)) return 'audio/mpeg'
  if (/\.m4a$/i.test(fileName)) return 'audio/mp4'
  if (/\.wav$/i.test(fileName)) return 'audio/wav'
  if (/\.ogg$/i.test(fileName)) return 'audio/ogg'
  return 'application/octet-stream'
}

export const Route = createFileRoute('/api/files/$fileId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url)
        const shareToken = url.searchParams.get('t')
        const wantsDownload = url.searchParams.get('download') === '1'

        const d = db()
        const file = (
          await d.select().from(workFiles).where(eq(workFiles.id, params.fileId)).limit(1)
        )[0]
        if (!file) return new Response('Fant ikke filen', { status: 404 })

        let shareLinkId: string | null = null
        let userId: string | null = null

        const me = await currentUser()
        if (me) {
          userId = me.id
          // Medlemmer har full arkivtilgang (stemmer/lyd/uplassert) by design,
          // men partitur er rettighetsstyrt (scores.view) — håndhev det server-side,
          // ikke bare i UI-et, slik at «styrbart partitur» faktisk gjelder.
          if (file.kind === 'score' && !hasPermission(me, 'scores.view')) {
            return new Response('Ingen tilgang til partitur', { status: 403 })
          }
        } else if (shareToken) {
          // Vikartilgang: token må være gyldig, og filen må tilhøre prosjektet
          // og en av stemmene som er delt (lydfiler er alltid med).
          const tokenHash = await sha256Hex(shareToken)
          const share = (
            await d.select().from(shareLinks).where(eq(shareLinks.tokenHash, tokenHash)).limit(1)
          )[0]
          if (!share || share.revokedAt || share.expiresAt.getTime() < Date.now()) {
            return new Response('Lenken er utløpt eller trukket tilbake', { status: 403 })
          }
          const inProject = (
            await d
              .select()
              .from(projectWorks)
              .where(and(eq(projectWorks.projectId, share.projectId), eq(projectWorks.workId, file.workId)))
              .limit(1)
          )[0]
          const sharedPartIds = JSON.parse(share.partIds) as string[]
          const allowed =
            !!inProject &&
            (file.kind === 'audio' || (file.kind === 'part' && !!file.partId && sharedPartIds.includes(file.partId)))
          if (!allowed) return new Response('Ingen tilgang til denne filen', { status: 403 })
          shareLinkId = share.id
        } else {
          return new Response('Krever innlogging', { status: 401 })
        }

        const object = await env.FILES.get(file.r2Key)
        if (!object) return new Response('Filen mangler i lageret', { status: 404 })

        if (wantsDownload) {
          // Revisjonslogg skal aldri blokkere selve nedlastingen.
          try {
            await d.insert(downloadLog).values({
              id: newId(),
              userId,
              shareLinkId,
              workFileId: file.id,
              at: new Date(),
            })
          } catch (err) {
            console.error('[download_log] kunne ikke logge nedlasting:', err)
          }
        }

        const disposition = `${wantsDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(file.fileName)}"`
        return new Response(object.body, {
          headers: {
            'Content-Type': contentTypeFor(file.fileName),
            'Content-Length': String(object.size),
            'Content-Disposition': disposition,
            'Cache-Control': 'private, max-age=300',
            'X-Robots-Tag': 'noindex',
            // Hindre at en delingstoken i URL-en lekker via Referer til tredjeparter.
            'Referrer-Policy': 'no-referrer',
          },
        })
      },
    },
  },
})
