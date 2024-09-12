/// <reference path="./.sst/platform/config.d.ts" />

const dns = {
  zoneId: 'Z01626782YYNKBXBBY87S',
  name: 'labs.webamboos.dev',
}

export default $config({
  app(input) {
    return {
      name: 'iot',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    }
  },
  async run() {
    const stagePrefix = $app.stage === 'production' ? '' : `${$app.stage}.`

    const iotDomain = `iot.${stagePrefix}${dns.name}`

    const iotCertificate = new aws.acm.Certificate('IoTCertificate', {
      domainName: iotDomain,
      validationMethod: 'DNS',
    })
    const validation = iotCertificate.domainValidationOptions
      .apply(domainValidationOptions => {
        return domainValidationOptions.map((options, i) => {
          return new aws.route53.Record(`IoTValidationRecord${i + 1}`, {
            allowOverwrite: true,
            name: options.resourceRecordName,
            type: options.resourceRecordType,
            zoneId: dns.zoneId,
            ttl: 60,
            records: [options.resourceRecordValue],
          })
        })
      })
      .apply(records => {
        return new aws.acm.CertificateValidation(
          'IoTCertificateValidation',
          {
            certificateArn: iotCertificate.arn,
          },
          { dependsOn: [...records] }
        )
      })

    new aws.iot.DomainConfiguration(
      'IoTDomain',
      {
        domainName: iotDomain,
        name: `${$app.stage}_iot_domain`,
        serverCertificateArns: [iotCertificate.arn],
        status: 'ENABLED',
        tlsConfig: {
          // https://docs.aws.amazon.com/iot/latest/developerguide/iot-endpoints-tls-config.html
          securityPolicy: 'IoTSecurityPolicy_TLS12_1_2_2022_10',
        },
      },
      { dependsOn: [iotCertificate, validation] }
    )

    const iotEndpoint = aws.iot.getEndpoint({ endpointType: 'iot:Data-ATS' })

    new aws.route53.Record('IoTEndpointAlias', {
      name: iotDomain,
      type: aws.route53.RecordType.CNAME,
      zoneId: dns.zoneId,
      records: $output(iotEndpoint).apply(e => [e.endpointAddress]),
      ttl: 3600,
    })

    const iot = new sst.Linkable('IoT', {
      properties: {
        Endpoint: iotDomain,
      },
      include: [sst.aws.permission({ actions: ['iot:*'], resources: ['*'] })],
    })

    const iotApi = new sst.aws.Function('IoTAPI', {
      handler: 'services/api/src/server.handler',
      link: [iot],
      url: {
        cors: false,
        authorization: 'iam',
      },
    })

    return {
      IoTDomain: iotDomain,
      IoTAPI: iotApi.url,
    }
  },
})
