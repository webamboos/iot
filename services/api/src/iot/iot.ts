import {
  AttachPolicyCommand,
  AttachThingPrincipalCommand,
  CreateKeysAndCertificateCommand,
  CreatePolicyCommand,
  CreateThingCommand,
  IoTClient,
} from '@aws-sdk/client-iot'

const iot = new IoTClient()

export async function createDevice(type: string, props: { name: string }) {
  const thing = await iot.send(
    new CreateThingCommand({
      thingName: props.name,
      // for later use.
      // thingTypeName: type,
    })
  )

  const keysAndCerts = await iot.send(
    new CreateKeysAndCertificateCommand({
      setAsActive: true,
    })
  )

  const policy = await iot.send(
    new CreatePolicyCommand({
      policyName: props.name,
      policyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'iot:*',
            Resource: '*',
          },
        ],
      }),
    })
  )

  await iot.send(
    new AttachPolicyCommand({
      policyName: policy.policyName,
      target: keysAndCerts.certificateArn,
    })
  )

  await iot.send(
    new AttachThingPrincipalCommand({
      principal: keysAndCerts.certificateArn,
      thingName: thing.thingName,
    })
  )

  return {
    name: thing.thingName,
    security: {
      certificatePem: keysAndCerts.certificatePem,
      publicKey: keysAndCerts.keyPair?.PublicKey,
      privateKey: keysAndCerts.keyPair?.PrivateKey,
    },
    /** @deprecated only for internal use */
    aws: {
      thingName: thing.thingName,
      policyName: policy.policyName,
      certificateId: keysAndCerts.certificateId,
      certificateArn: keysAndCerts.certificateArn,
    },
  }
}
