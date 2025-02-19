#!/usr/bin/env node
import 'source-map-support/register'
import { App } from 'aws-cdk-lib'
import { Pipeline } from '../lib/pipeline'
import { Application, Dns } from '../lib/application'
import { ConfigHelper, Tier } from '@pixartprinting-devops/cdk-constructs'
// import { ConfigHelper, Tier } from '../constructs/configHelper'

console.log('Hello')
const app = new App()
const tier = app.node.tryGetContext('tier')
const config = new ConfigHelper('config.yaml')

switch (tier) {
  case Tier.PIPELINE:
    new Pipeline(app, config)
    break
  case Tier.STAGING:
    
    break
  case Tier.PRODUCTION:
    
    break
  default:
    console.log('Please define the tier context: production | staging | pipeline. es: --context tier=pipeline')
    break
}