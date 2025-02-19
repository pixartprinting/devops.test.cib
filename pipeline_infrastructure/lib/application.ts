import { Construct } from 'constructs'
import { Vpc } from 'aws-cdk-lib/aws-ec2'
import { Cluster } from 'aws-cdk-lib/aws-ecs'
import { Platform } from 'aws-cdk-lib/aws-ecr-assets'
import { Auth0ConfigHelper, Auth0OneNonProductionHttpsAlb, BaseDashboard, BaseStack, EcsService, GetAcmCertificateFromDomainName, IAuth0OneNonProductionHttpsAlbAddRuleProps, Tier } from '@pixartprinting-devops/cdk-constructs'
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53'
import { Bucket } from 'aws-cdk-lib/aws-s3'

export class Application extends BaseStack {
  constructor(scope: Construct, config: Auth0ConfigHelper, tier: string) {
    super(scope, tier, config)

    const token = <string>process.env.GIT_TOKEN
    if (!process.env.GIT_TOKEN) {
      console.error("GIT_TOKEN env vars is Not set! Do command:")
      console.error(`export GIT_TOKEN=$(aws --region ${this.region} ssm get-parameter --name gittoken --with-decryption --query 'Parameter.Value' --output text)`)
      process.exitCode = 1
    }

    const vpc = Vpc.fromLookup(this, 'vpc', { vpcName: config.aws.vpcName })
    const cluster = new Cluster(this, 'cluster', { vpc: vpc })
    const baseContainerImageProps = {
      directory: '../',
      platform: Platform.LINUX_AMD64
    }

    const app = new EcsService(this, 'status-page', tier, config, {
      cpu: 256,
      memoryLimitMiB: 512,
      cluster: cluster,
      desiredCount: 1,
      containers: [
        {
          name: 'web',
          image: {
            ...baseContainerImageProps,
            file: 'docker/web/Dockerfile',
          },
          environment: { FCGI_HOST: 'localhost' },
          portMappings: [{ containerPort: 80 }]
        },
        {
          name: 'app',
          image: {
            ...baseContainerImageProps,
            file: 'docker/app/Dockerfile',
            buildArgs: { COMPOSER_AUTH: '{"http-basic":{},"github-oauth":{"github.com":"' + token + '"}}' }
          },
          environment: {
            APP_ENV: tier,
            APP_NAME: config.appName,
            APP_BRANCH_NAME: config.appBranchName,
            APP_BRANCH_ID: config.appBranchId,
            APP_DOMAIN: config.appDomain(tier)
          }
        }
      ]
    })

    Bucket.fromBucketName(this, 'bucket', 'status-page-events').grantReadWrite(app.service.taskDefinition.taskRole)

    const auth0OneNonProductionHttpsAlb = new Auth0OneNonProductionHttpsAlb(this, 'load-balancer', tier, config, {
      vpc: vpc,
      domainName: config.aws.hostedZoneName!,
      hostName: config.appDomainAlb(tier),
      certificateArn: tier == Tier.PRODUCTION ? new GetAcmCertificateFromDomainName(this, 'certificate', '*.pixartprinting.com').arn : undefined
    })
    auth0OneNonProductionHttpsAlb.addTargetsAuth0('app', {
      healthCheck: { path: '/healthcheck' },
      targets: [app.service],
      port: 80,
      addRules: <IAuth0OneNonProductionHttpsAlbAddRuleProps[]>[
        { name: 'protected', pathConditions: ['/*'], auth0Protected: true }
      ]
    })

    // Dashboard
    //const dashboard = new BaseDashboard(this, 'dashboard', {
    //  dashboardName: `${config.appName}-${config.branchName()}-${tier}`
    //})
    //dashboard.addHeadWidget('App')
    //dashboard.addDefaultTargetGroupWidgets({
    //  targetGroup: targetGroup.targetGroupFullName,
    //  loadBalancer: auth0HttpsAlb.albFullName
    //})
    //dashboard.addDefaultEcsWidgets(app.createDefaultDashboardProps())

    auth0OneNonProductionHttpsAlb.createRecordA(config.appDomainAlb(tier))
  }
}

export class Dns extends BaseStack {
  constructor(scope: Construct, config: Auth0ConfigHelper, tier: string) {
    super(scope, tier, config, {
      id: `${config.stackName(tier)}-dns`,
      env: { account: '925770124887', region: config.defaultEnv.region }
    })

    new CnameRecord(this, 'dns', {
      zone: HostedZone.fromLookup(this, `zone-id`, { domainName: 'pixartprinting.com' }),
      domainName: config.appDomainAlb(tier),
      recordName: 'status'
    })
  }
}