import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { IoT } from './iot'

const app = new Hono()

app.post(
  '/devices',
  zValidator(
    'json',
    z.object({
      name: z.string().max(64),
      type: z.string().max(32),
    })
  ),
  async c => {
    const body = c.req.valid('json')

    const device = await IoT.createDevice(body.type, {
      name: body.name,
    })

    return c.json(device, 201)
  }
)

export const handler = handle(app)
