# Ember-cli-deploy-redis

> An ember-cli-deploy-plugin to upload index.html to a Redis store

<hr/>
**WARNING: This plugin is only compatible with ember-cli-deploy versions >= 0.5.0**
<hr/>

This plugin uploads a file, presumably index.html, to a specified Redis store.

More often than not this plugin will be used in conjunction with the [lightning method of deployment][1] where the ember application assets will be served from S3 and the index.html file will be served from Redis. However, it can be used to upload any file to a Redis store.

## What is an ember-cli-deploy plugin?

A plugin is an addon that can be executed as a part of the ember-cli-deploy pipeline. A plugin will implement one or more of the ember-cli-deploy's pipeline hooks.

For more information on what plugins are and how they work, please refer to the [Plugin Documentation][2].

## Quick Start
To get up and running quickly, do the following:

- Ensure [ember-cli-deploy-build][4] is installed and configured.

- Install this plugin

```bash
$ ember install ember-cli-deploy-redis
```

- Place the following configuration into `config/deploy.js`

```javascript
ENV.redis {
  host: '<your-redis-host>',
  port: <your-redis-port>,
  password: '<your-redis-password>'
}
```

- Run the pipeline

```bash
$ ember deploy
```

## Installation
Run the following command in your terminal:

```bash
ember install ember-cli-deploy-redis
```

## ember-cli-deploy Hooks Implemented
- `configure`
- `upload`
- `activate`
- `didDeploy`

## Configuration Options

### host

The Redis host. If [url](#url) is defined, then this option is not needed.

*Default:* `'localhost'`

### port

The Redis port. If [url](#url) is defined, then this option is not needed.

*Default:* `6379`

### password

The Redis password. If [url](#url) is defined, then this option is not needed.

*Default:* `null`

### url

A Redis connection url to the Redis store

*Example:* 'redis://some-user:some-password@some-host.com:1234'

### filePattern

A file matching this pattern will be uploaded to Redis.

*Default:* `'index.html'`

### distDir

The root directory where the file matching `filePattern` will be searched for. By default, this option will use the `distDir` property of the deployment context.

*Default:* `context.distDir`

### keyPrefix

The prefix to be used for the Redis key under which file will be uploaded to Redis. The Redis key will be a combination of the `keyPrefix` and the `revisionKey`. By default this option will use the `project.name()` property from the deployment context.

*Default:* `context.project.name() + ':index'`

### revisionKey

The unique revision number for the version of the file being uploaded to Redis. The Redis key will be a combination of the `keyPrefix` and the `revisionKey`. By default this option will use either the `revisionKey` passed in from the command line or the `revisionKey` property from the deployment context.

*Default:* `context.commandLineArgs.revisionKey || context.revisionKey` 

### redisDeployClient

The Redis client to be used to upload files to the Redis store. By default this option will use a new instance of the [Redis][3] client unless another client is provided in the `redisDeployClient` property of the deployment context. This allows for injection of a mock client for testing purposes.

*Default:* `context.redisDeployClient || new Redis(context.config.redis)`

### didDeployMessage

A message that will be displayed after the file has been successfully uploaded to Redis. By default this message will only display if the revision for `revisionKey` of the deployment context has been activated.

*Default:* 

```javascript
if (context.revisionKey && !context.activatedRevisionKey) {
  return "Deployed but did not activate revision " + context.revisionKey + ". "
       + "To activate, run: "
       + "ember deploy:activate " + context.revisionKey + " --environment=" + context.deployEnvironment + "\n";
}
```

## Prerequisites

The following properties are expected to be present on the deployment `context` object:

- `distDir`                     (provided by [ember-cli-deploy-build][4])
- `project.name()`              (provided by [ember-cli-deploy][5])
- `revisionKey`                 (provided by [ember-cli-deploy-revision-key][6])
- `commandLineArgs.revisionKey` (provided by [ember-cli-deploy][5])
- `deployEnvironment`           (provided by [ember-cli-deploy][5])

## Running Tests

- `npm test`

[1]: https://github.com/lukemelia/ember-cli-deploy-lightning-pack "ember-cli-deploy-lightning-pack"
[2]: http://ember-cli.github.io/ember-cli-deploy/plugins "Plugin Documentation"
[3]: https://www.npmjs.com/package/redis "Redis Client"
[4]: https://github.com/zapnito/ember-cli-deploy-build "ember-cli-deploy-build"
[5]: https://github.com/ember-cli/ember-cli-deploy "ember-cli-deploy"
[6]: https://github.com/zapnito/ember-cli-deploy-revision-key "ember-cli-deploy-revision-key"
