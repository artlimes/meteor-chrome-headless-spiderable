Tested on Linux (will be tested on Mac and Windows soon)
Works on Chrome versions >= 59.0


Spiderable is configured through Meteor settings.json file

Main settings:  (will update soon with more)

You can use a local instance of chrome by specifying:
  Meteor.settings.spiderable.useLocalChrome=true
  Meteor.settings.chromePath = "xxx" //to specify the path of the executable

Alternately you can use a remote chrome instance (e.g docker) by specifying the ip(or address) (now connect to port 9222)
  Meteor.settings.spiderable.chromeIp = "chrome-headless"

You can set if you want the cached pages to be deleted from the database and if yes after how much time.
  Meteor.settings.spiderable.cacheLifetimeInMinutes = null; // no expirarion
  Meteor.settings.spiderable.cacheLifetimeInMinutes = 100 * 60 * 60 // delete after 100 hours.

You can also set routes that you don't want to be cached:
  Meteor.settings.spiderable.ignoredRoutes = ["/assets/", "/sitemap.xml"] //default

Also you can define a Query that will get add at the end of the cached url in order to have custom client logic at rendering stage
  Meteor.settings.spiderable.customQuery = "isGettingCached"; //default

In order to trigger the manual caching/recaching of a page you can call:
  Spiderable.makeCacheOfPage(urlPath);

