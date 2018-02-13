Package.describe({
  name: 'artlimes:meteor-chrome-spiderable',
  summary: 'spiderable ,with mongo caching, using headless chrome',
  version: '0.7.0',
  git: 'https://github.com/artlimes/chrome-meteor-spiderable'
});

Npm.depends({
  'chrome-launcher': '0.10.2',
  'chrome-remote-interface': '0.24.0'
});

Package.onUse(function (api) {
  api.versionsFrom('METEOR@1.4');
  api.use(['webapp', 'mongo'], 'server');
  api.use(['templating'], 'client');
  api.use(['underscore', 'ecmascript'], ['server']);

  api.mainModule('lib/spiderable.js', ['server']);
  api.addFiles('lib/server.js', 'server');
  api.export('Spiderable');
});
