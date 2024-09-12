import { afterAll, describe, expect, test } from 'vitest'
import { IoT } from '.'
import mqtt from 'mqtt'
import { Resource } from 'sst'
import {
  DeleteCertificateCommand,
  DeletePolicyCommand,
  DeleteThingCommand,
  DetachPolicyCommand,
  DetachThingPrincipalCommand,
  IoTClient,
  UpdateCertificateCommand,
} from '@aws-sdk/client-iot'

describe('iot', { timeout: 20000 }, () => {
  let device: Awaited<ReturnType<(typeof IoT)['createDevice']>>
  test.sequential('should create device', async () => {
    device = await IoT.createDevice('sensor', {
      name: `test-sensor-${Date.now()}`,
    })

    expect(device).toBeTruthy()
    expect(device.security.certificatePem).toBeTypeOf('string')
    expect(device.security.privateKey).toBeTypeOf('string')
    expect(device.security.publicKey).toBeTypeOf('string')
  })

  test.sequential('should connect to mqtt', async () => {
    const caResponse = await fetch(
      'https://www.amazontrust.com/repository/AmazonRootCA1.pem'
    )
    const ca = await caResponse.text()
    expect(ca).toBeTypeOf('string')

    const mqttUrl = `mqtts://${Resource.IoT.Endpoint}:8883`

    const client = mqtt.connect(mqttUrl, {
      ca: [ca],
      key: device.security.privateKey,
      cert: device.security.certificatePem,
      protocolId: 'MQTT',
      protocolVersion: 5,
      connectTimeout: 10000,
    })

    await new Promise<mqtt.IConnackPacket>(resolve => {
      client.on('connect', resolve)
    })

    const publishedMessage = await client.publishAsync('/test/1', 'test', {
      qos: 1,
    })

    expect(publishedMessage?.messageId).toBeTruthy()
  })

  afterAll(async () => {
    // cleanup
    const iot = new IoTClient()

    const detachPolicy = new DetachPolicyCommand({
      policyName: device.aws.policyName,
      target: device.aws.certificateArn,
    })
    const deletePolicy = new DeletePolicyCommand({
      policyName: device.aws.policyName,
    })
    const deactivateCertificate = new UpdateCertificateCommand({
      certificateId: device.aws.certificateId,
      newStatus: 'INACTIVE',
    })
    const detachThing = new DetachThingPrincipalCommand({
      thingName: device.aws.thingName,
      principal: device.aws.certificateArn,
    })
    const deleteCertificate = new DeleteCertificateCommand({
      certificateId: device.aws.certificateId,
    })
    const deleteThing = new DeleteThingCommand({
      thingName: device.aws.thingName,
    })

    // these must be in this order to cleanly remove all residuals.
    await iot.send(detachPolicy)
    await iot.send(deletePolicy)
    await iot.send(deactivateCertificate)
    await iot.send(detachThing)
    await iot.send(deleteCertificate)
    await iot.send(deleteThing)
  })
})
