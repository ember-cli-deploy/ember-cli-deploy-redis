# ember-cli-deploy-redis

> An ember-cli-deploy plugin to upload index.html to a Redis store

[![](https://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/plugins/ember-cli-deploy-redis.svg)](http://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/)

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
ENV.redis = {
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

For detailed information on what plugin hooks are and how they work, please refer to the [Plugin Documentation][2].

- `configure`
- `upload`
- `willActivate`
- `activate`
- `didDeploy`

## Configuration Options

For detailed information on how configuration of plugins works, please refer to the [Plugin Documentation][2].

### host

The Redis host. If [url](#url) is defined, then this option is not needed.

*Default:* `'localhost'`

### port

The Redis port. If [url](#url) is defined, then this option is not needed.

*Default:* `6379`

This option must not be overwritten if you're using [ember-cli-deploy-ssh-tunnel][7], where the default is `context.tunnel.srcPort`.

### database

The Redis database number. If [url](#url) is defined, then this option is not needed.

*Default:* `undefined`

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

### activationSuffix

The suffix to be used for the Redis key under which the activated revision will be stored in Redis. By default this option will be `"current"`. This makes the default activated revision key in Redis looks like: `project.name() + ':index:current'`

*Default:* `current`

### revisionKey

The unique revision number for the version of the file being uploaded to Redis. The Redis key will be a combination of the `keyPrefix` and the `revisionKey`. By default this option will use either the `revision` passed in from the command line or the `revisionData.revisionKey` property from the deployment context.

*Default:* `context.commandOptions.revision || context.revisionData.revisionKey`

### activeContentSuffix

The suffix to be used for the Redis key under which the activated revision content will be stored in Redis. By default this option will be `"current-content"`. This makes the default activated revision in Redis looks like: `project.name() + ':index:current-content'`

This makes it possible to serve content completely from within NGINX using the [redis](https://www.nginx.com/resources/wiki/modules/redis/) module without doing a primary key lookup.

```
  server {
    location / {
      set $redis_key project-name:index:current-content;
      redis_pass     name:6379;
      default_type   text/html;
    }
  }
```

*Default:* `current-content`

### allowOverwrite

A flag to specify whether the revision should be overwritten if it already exists in Redis.

*Default:* `false`

### redisDeployClient

The Redis client to be used to upload files to the Redis store. By default this option will use a new instance of the [Redis][3] client. This allows for injection of a mock client for testing purposes.

*Default:* `return new Redis(options)`

### didDeployMessage

A message that will be displayed after the file has been successfully uploaded to Redis. By default this message will only display if the revision for `revisionData.revisionKey` of the deployment context has been activated.

```javascript
if (context.revisionData.revisionKey && !context.revisionData.activatedRevisionKey) {
  return "Deployed but did not activate revision " + context.revisionData.revisionKey + ". "
       + "To activate, run: "
       + "ember deploy:activate " + context.revisionData.revisionKey + " --environment=" + context.deployEnvironment + "\n";
}
```

### tls

An optional tls configuration object for connecting to redis instances with encryption-in-transit enabled. Please see [https://github.com/luin/ioredis#tls-options](https://github.com/luin/ioredis#tls-options) for available options

*Default:* `null`

### maxRecentUploads

The maximum number of recent revisions to keep in Redis.

*Default:* `10`

### revisionData

Metadata about the revision being uploaded. (normally provided by a plugin like [ember-cli-deploy-revision-data][6])

## Activation

As well as uploading a file to Redis, *ember-cli-deploy-redis* has the ability to mark a revision of a deployed file as `current`. This is most commonly used in the [lightning method of deployment][1] whereby an index.html file is pushed to Redis and then served to the user by a web server. The web server could be configured to return any existing revision of the index.html file as requested by a query parameter. However, the revision marked as the currently `active` revision would be returned if no query paramter is present. For more detailed information on this method of deployment please refer to the [ember-cli-deploy-lightning-pack README][1].

### How do I activate a revision?

A user can activate a revision by either:

- Passing a command line argument to the `deploy` command:

```bash
$ ember deploy --activate=true
```

- Running the `deploy:activate` command:

```bash
$ ember deploy:activate <revision-key>
```

- Setting the `activateOnDeploy` flag in `deploy.js`

```javascript
ENV.pipeline = {
  activateOnDeploy: true
}
```

### What does activation do?

When *ember-cli-deploy-redis* uploads a file to Redis, it uploads it under the key defined by a combination of the two config properties `keyPrefix` and `revisionKey`.

So, if the `keyPrefix` was configured to be `my-app:index` and there had been 3 revisons deployed, then Redis might look something like this:

```bash
$ redis-cli

127.0.0.1:6379> KEYS *
1) my-app:index:revisions
2) my-app:index:9ab2021411f0cbc5ebd5ef8ddcd85cef
3) my-app:index:499f5ac793551296aaf7f1ec74b2ca79
4) my-app:index:f769d3afb67bd20ccdb083549048c86c
```

Activating a revison would add a new entry to Redis pointing to the currently active revision:

```bash
$ ember deploy:activate f769d3afb67bd20ccdb083549048c86c

$ redis-cli

127.0.0.1:6379> KEYS *
1) my-app:index:revisions
2) my-app:index:9ab2021411f0cbc5ebd5ef8ddcd85cef
3) my-app:index:499f5ac793551296aaf7f1ec74b2ca79
4) my-app:index:f769d3afb67bd20ccdb083549048c86c
5) my-app:index:current

127.0.0.1:6379> GET my-app:index:current
"f769d3afb67bd20ccdb083549048c86c"
```

### When does activation occur?

Activation occurs during the `activate` hook of the pipeline. By default, activation is turned off and must be explicitly enabled by one of the 3 methods above.

## Listing Revisions

Another helpful part of the [lightning method of deployment][1] is using [ember-cli-deploy-display-revisions][8] to quickly review previously deployed revisions to your redis instance.

### How do I display the deployed revisions on my redis instance?

First, install the [ember-cli-deploy-display-revisions][8] plugin:

```
ember install ember-cli-deploy-display-revisions
```

Then use the following command:

```
$ ember deploy:list <environment>

- Listing revisions for key: `my-app`
 RevisionKey  Commit    User                   Branch
 > 8af596f    af596fbb  email@example.com      staging
   18cf1a6    8cf1a6c9  email@example.com      staging
   82be0d2    2be0d26c  email@example.com      staging
   7dee0a0    dee0a0b3  email@example.com      staging
   937899e    37899eb6  email@example.com      staging
   f4cfc1f    4cfc1f0b  email@example.com      staging
   d748d1b    748d1bc4  email@example.com      staging
   c6d9fb1    6d9fb155  email@example.com      staging
   128a967    28a96772  email@example.com      staging
   bfb5e46    fb5e46dc  email@example.com      staging
```

## What if my Redis server isn't publicly accessible?

Not to worry! Just install the handy-dandy `ember-cli-deploy-ssh-tunnel` plugin:

```
ember install ember-cli-deploy-ssh-tunnel
```

Add set up your `deploy.js` similar to the following:

```js
  'redis': {
    host: "localhost",
  },
  'ssh-tunnel': {
    username:       "your-ssh-username",
    host:           "remote-redis-host"
  }
```

### What if my Redis server is only accessible *from* my remote server?

Sometimes you need to SSH into a server (a "bastion" server) and then run
`redis-cli` or similar from there. This is really common if you're using
Elasticache on AWS, for instance. We've got you covered there too - just
set your SSH tunnel host to the bastion server, and tell the tunnel to use
your Redis host as the destination host, like so:

```js
  'redis': {
    host: "localhost",
  },
  'ssh-tunnel': {
    username:       "your-ssh-username",
    host:           "remote-redis-host"
    dstHost:        "location-of-your-elasticache-node-or-remote-redis"
  }
```

## Prerequisites

The following properties are expected to be present on the deployment `context` object:

- `distDir`                     (provided by [ember-cli-deploy-build][4])
- `project.name()`              (provided by [ember-cli-deploy][5])
- `revisionData.revisionKey`    (provided by [ember-cli-deploy-revision-data][6])
- `commandLineArgs.revisionKey` (provided by [ember-cli-deploy][5])
- `deployEnvironment`           (provided by [ember-cli-deploy][5])

The following properties are used if present on the deployment `context` object:

- `tunnel.srcPort`              (provided by [ember-cli-deploy-ssh-tunnel][7])

## Running Tests

* yarn test

## Why `ember build` and `ember test` don't work

Since this is a node-only ember-cli addon, this package does not include many files and dependencies which are part of ember-cli's typical `ember build` and `ember test` processes.

[1]: https://github.com/ember-cli-deploy/ember-cli-deploy-lightning-pack "ember-cli-deploy-lightning-pack"
[2]: http://ember-cli-deploy.com/docs/v1.0.x/using-plugins/ "Plugin Documentation"
[3]: https://www.npmjs.com/package/redis "Redis Client"
[4]: https://github.com/ember-cli-deploy/ember-cli-deploy-build "ember-cli-deploy-build"
[5]: https://github.com/ember-cli-deploy/ember-cli-deploy "ember-cli-deploy"
[6]: https://github.com/ember-cli-deploy/ember-cli-deploy-revision-data "ember-cli-deploy-revision-data"
[7]: https://github.com/ember-cli-deploy/ember-cli-deploy-ssh-tunnel "ember-cli-deploy-ssh-tunnel"
[8]: https://github.com/ember-cli-deploy/ember-cli-deploy-display-revisions "ember-cli-deploy-display-revisions"
