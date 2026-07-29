/**
 * Advance an existing WORKBENCH draft through Reserve→Pick→Pack→Issue challan (stop before Post).
 * For UI Scenario A: open the dispatch and click Post Dispatch (7C5).
 *
 *   npx tsx scripts/advance-7c5-to-ready-post.ts [dispatchId]
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = 'vasant-trailers'
const dispatchId = process.argv[2] ?? '8329de9a-d2bb-4ef0-a359-609439965c28'
const app = createApp()

async function main() {
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
    tenantSlug: TENANT_SLUG,
  })
  if (login.status !== 200) throw new Error(`login ${login.status}`)
  const token = login.body.data.accessToken as string
  const auth = (req: request.Test) => req.set({ Authorization: `Bearer ${token}` })
  const dsp = `/api/v1/t/${TENANT_SLUG}/dispatch`

  const ob = await auth(request(app).get(`${dsp}/outbound/${dispatchId}`))
  if (ob.status !== 200) throw new Error(`outbound ${ob.status} ${JSON.stringify(ob.body)}`)
  const status = ob.body.data.status as string
  const dispatchNo = ob.body.data.dispatchNumber ?? ob.body.data.dispatchNo
  const lineId = ob.body.data.lines[0].id as string
  const qty = Number(ob.body.data.lines[0].quantity ?? ob.body.data.lines[0].plannedQty ?? 1)

  if (status === 'CONFIRMED') {
    console.log(JSON.stringify({ ok: true, already: 'CONFIRMED', dispatchNo, dispatchId }))
    return
  }

  const ready0 = await auth(request(app).get(`${dsp}/outbound/${dispatchId}/posting-readiness`))
  const gates = ready0.body?.data?.gates?.posting
  if (gates?.ready) {
    console.log(
      JSON.stringify({
        ok: true,
        readyToPost: true,
        dispatchNo,
        dispatchId,
        url: `http://127.0.0.1:5173/dispatch/${dispatchId}`,
      }),
    )
    return
  }

  // Reserve (idempotent-ish)
  const reserve = await auth(
    request(app)
      .post(`${dsp}/orders/${dispatchId}/reservations`)
      .send({
        lines: [{ outboundDispatchLineId: lineId, quantity: qty }],
        idempotencyKey: `uat-res-${dispatchId}`,
      }),
  )
  if (![200, 201, 409].includes(reserve.status)) {
    throw new Error(`reserve ${reserve.status} ${JSON.stringify(reserve.body)}`)
  }

  let pickListId: string | undefined
  let pickLineId: string | undefined
  const existingPicks = await auth(request(app).get(`${dsp}/orders/${dispatchId}/pick-lists`))
  if (existingPicks.status === 200 && existingPicks.body.data?.[0]) {
    pickListId = existingPicks.body.data[0].id
    pickLineId = existingPicks.body.data[0].lines?.[0]?.id
  } else {
    const pickLists = await auth(
      request(app)
        .post(`${dsp}/orders/${dispatchId}/pick-lists`)
        .send({ idempotencyKey: `uat-pkl-${dispatchId}` }),
    )
    if (pickLists.status !== 201) throw new Error(`pkl ${pickLists.status} ${JSON.stringify(pickLists.body)}`)
    pickListId = pickLists.body.data[0].id
    pickLineId = pickLists.body.data[0].lines[0].id
  }

  await auth(request(app).post(`${dsp}/pick-lists/${pickListId}/release`))
  await auth(request(app).post(`${dsp}/pick-lists/${pickListId}/start`))
  const pick = await auth(
    request(app)
      .post(`${dsp}/pick-lists/${pickListId}/pick`)
      .send({ pickLineId, quantity: qty, idempotencyKey: `uat-pick-${pickLineId}` }),
  )
  if (![200, 201, 409].includes(pick.status)) {
    throw new Error(`pick ${pick.status} ${JSON.stringify(pick.body)}`)
  }
  await auth(request(app).post(`${dsp}/pick-lists/${pickListId}/complete`))

  let packingSessionId: string | undefined
  let packageId: string | undefined
  const sessionsList = await auth(request(app).get(`${dsp}/orders/${dispatchId}/packing-sessions`))
  if (sessionsList.status === 200 && sessionsList.body.data?.[0]) {
    packingSessionId = sessionsList.body.data[0].id
  } else {
    const sessions = await auth(
      request(app)
        .post(`${dsp}/orders/${dispatchId}/packing-sessions`)
        .send({ idempotencyKey: `uat-pack-sess-${dispatchId}` }),
    )
    if (sessions.status !== 201) throw new Error(`pack sess ${sessions.status} ${JSON.stringify(sessions.body)}`)
    packingSessionId = sessions.body.data[0].id
  }
  await auth(request(app).post(`${dsp}/packing-sessions/${packingSessionId}/start`))
  const pkgs = await auth(request(app).get(`${dsp}/packing-sessions/${packingSessionId}/packages`)).catch(() => null)
  if (pkgs && pkgs.status === 200 && pkgs.body.data?.[0]) {
    packageId = pkgs.body.data[0].id
  } else {
    const pkg = await auth(
      request(app)
        .post(`${dsp}/packing-sessions/${packingSessionId}/packages`)
        .send({ packageReference: 'BOX-UAT-A' }),
    )
    if (pkg.status !== 201) throw new Error(`pkg ${pkg.status} ${JSON.stringify(pkg.body)}`)
    packageId = pkg.body.data.id
  }
  const pack = await auth(
    request(app)
      .post(`${dsp}/packages/${packageId}/pack`)
      .send({ pickLineId, quantity: qty, idempotencyKey: `uat-pack-${packageId}` }),
  )
  if (![200, 201, 409].includes(pack.status)) {
    throw new Error(`pack ${pack.status} ${JSON.stringify(pack.body)}`)
  }
  await auth(request(app).post(`${dsp}/packing-sessions/${packingSessionId}/complete`))
  await auth(request(app).post(`${dsp}/packing-sessions/${packingSessionId}/verify`))

  let challanId: string | undefined
  const challans = await auth(request(app).get(`${dsp}/orders/${dispatchId}/delivery-challans`))
  if (challans.status === 200 && challans.body.data?.[0]) {
    challanId = challans.body.data[0].id
  } else {
    const challan = await auth(
      request(app)
        .post(`${dsp}/orders/${dispatchId}/delivery-challans`)
        .send({ idempotencyKey: `uat-dc-${dispatchId}` }),
    )
    if (challan.status !== 201) throw new Error(`challan ${challan.status} ${JSON.stringify(challan.body)}`)
    challanId = challan.body.data.id
  }
  await auth(request(app).post(`${dsp}/delivery-challans/${challanId}/ready-for-review`))
  await auth(request(app).post(`${dsp}/delivery-challans/${challanId}/approve`))
  const issued = await auth(
    request(app)
      .post(`${dsp}/delivery-challans/${challanId}/issue`)
      .send({ idempotencyKey: `uat-issue-${challanId}` }),
  )
  if (![200, 201, 409].includes(issued.status)) {
    throw new Error(`issue ${issued.status} ${JSON.stringify(issued.body)}`)
  }

  const ready = await auth(request(app).get(`${dsp}/outbound/${dispatchId}/posting-readiness`))
  console.log(
    JSON.stringify(
      {
        ok: true,
        dispatchNo,
        dispatchId,
        postingReady: Boolean(ready.body?.data?.gates?.posting?.ready),
        allowedActions: ready.body?.data?.allowedActions,
        url: `http://127.0.0.1:5173/dispatch/${dispatchId}`,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(String(e))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
