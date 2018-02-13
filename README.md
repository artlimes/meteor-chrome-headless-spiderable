Tested on Linux
Works on Chrome versions >= 59.0  (For windows this should be >=60 as then chrome headless was introduced)


Spiderable is configured through Meteor settings.json file

Basic settings:  (will update soon with more)

You can use a local instance of chrome by specifying:
  Meteor.settings.spiderable.useLocalChrome=true  // the path of the executable will be resolved automatically


Alternately you can use a remote chrome instance (e.g docker) by specifying the ip and port (default: 9222)
  Meteor.settings.spiderable.chromeIp = "chrome-headless"

You can set the interval after which the indexed pages will be removed from the database.
  Meteor.settings.spiderable.cacheLifetimeInMinutes = null; // no expirarion
  Meteor.settings.spiderable.cacheLifetimeInMinutes = 100 * 60 // delete after 100 hours.

You can also set routes that you don't want to be cached:
  Meteor.settings.spiderable.ignoredRoutes = ["/assets/", "/sitemap.xml"] //default

Also you can define a Query that will get add at the end of the cached url in order to have custom client logic at rendering stage
  Meteor.settings.spiderable.customQuery = "isGettingCached"; //default

In order to trigger the manual caching/recaching of a page you can call-server side:
  Spiderable.makeCacheOfPage(urlPath);

