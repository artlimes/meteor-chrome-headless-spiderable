# Meteor Chrome Headless Spiderable

What is it? A complete implementation of Meteor Spiderable WebApp using Chrome Headless. 

In Meteor, Spiderable makes your webapp crawlable by spiders to allow search engines to cache your pages. The problem is that it's not always fast and doesn't allow for much control.

This implementation is using the new Chrome Headless browser for rendering your pages and gives you full control, while it caches your pages much faster.

## Prequisities
Works on:
* Linux/OSX: Chrome >= 59.0
* Windows: Chrome >=60 (as this is when chrome headless was introduced)

## Get Setup
Spiderable is configured through Meteor's `settings.json` file.

### Use Chrome Headless Locally
You can use a local instance of Chrome by specifying:
```js
// the Chrome path of the executable will be resolved automagically
Meteor.settings.spiderable.useLocalChrome = true; 
```

### Use Chrome Headless Remotely
Alternately, you can use a remote chrome instance (e.g with Docker) by specifying the Docker instance name or IP, and the port (default: 9222)
```js
Meteor.settings.spiderable.useLocalChrome = false
// completely optional, as they are resolved by the Docker instance when linked
Meteor.settings.spiderable.chromeIp = "chrome-headless";
Meteor.settings.spiderable.chromePort = 9222;
```

#### Setup a Docker Instance of Chrome Headless
Setup Image `alpeware/chrome-headless-trunk`. 

Then create a Link from your app container, to the Chrome instance by using the chrome headless alias you used.

### Additional Settings
You can set the interval after which the indexed pages will be removed from the database.
```js
Meteor.settings.spiderable.cacheLifetimeInMinutes = null; // no expiraration
Meteor.settings.spiderable.cacheLifetimeInMinutes = 100 * 60 // delete after 100 hours.
```

You can also exclude routes that you don't want cached:
```js
Meteor.settings.spiderable.ignoredRoutes = ["/assets/", "/sitemap.xml"];
```

Also you can define a SearchQuery to add at the end of the cached url for custom client-side logic at rendering time:
```js
Meteor.settings.spiderable.customQuery = "isGettingCached"; //default
```

To trigger the caching/re-caching of a page you call the following:
```js
// Server-side
import to Spiderable

Spiderable.makeCacheOfPage(urlPath);
```
Or by simply visiting the page you want: `http://example.com/my-page?_escaped_fragment_=`

### Coming Soon...
We're working on more settings and options.

## Setup with Reaction Commerce
[Reaction Commerce](https://reactioncommerce.com) is to most advanced open-source e-commerce platform built on Meteor and Node. You can make use of this plugin, by installing the [Reaction Commerce Caching Plugin](https://github.com/artlimes/reaction-commerce-caching-plugin).


