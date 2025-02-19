import { Construct } from 'constructs'
import { BasePipeline, ConfigHelper, Environment } from '@pixartprinting-devops/cdk-constructs'
// import { BasePipeline, ConfigHelper, Environment } from '../constructs/configHelper'


export class Pipeline extends BasePipeline {
  constructor(scope: Construct, config: ConfigHelper) {
    super(scope, config, { basePath: 'infrastructure' })

    const releaseBuildSpec = this.cdkBuildspec({ deploy: true })
    this.addStageOneAction('Staging', releaseBuildSpec, { envVars: { APP_ENV: { value: Environment.STAGING } } })
    this.addStageManualApprove()
    this.addStageOneAction('Production', releaseBuildSpec, { envVars: { APP_ENV: { value: Environment.PRODUCTION } } })
  }
}
