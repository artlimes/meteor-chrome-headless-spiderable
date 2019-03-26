# Meteor Chrome Headless Spiderable

What is it? A complete implementation of Meteor Spiderable WebApp using Chrome Headless. 

In Meteor, Spiderable makes your webapp crawlable by spiders to allow search engines to access your pages' content. The problem is that phantomjs often behaves abnormally or crashes and doesn't allow for much control.

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
Meteor.settings.spiderable.cacheLifetimeInMinutes = null; // no expiration
Meteor.settings.spiderable.cacheLifetimeInMinutes = 100 * 60 // delete after 100 hours.
```

You can also exclude routes that you don't want cached:
```js
Meteor.settings.spiderable.ignoredRoutes = ["/assets/", "/sitemap.xml"];
```

Also you can define a SearchQuery to add at the end of the cached url for custom client-side logic at rendering time:
```js
Meteor.settings.spiderable.customQuery = "__isGettingPrerendered__";
```

In case you don't want the url query to be taken into account, so regardless of the query, only the clean url and its
cached content is being stored to db and served to spiders, you can use:
```js
Meteor.settings.spiderable.stripUrlQuery = true;
```

If for some reason, you want to serve the content of a different page than the one being accessed by a spider you can use:
  ```js
  Meteor.settings.urlPathReplacements = [ ["original", "replacement"],["original2", "replacement2" ], ...etc ]; 
  ```
So if a spider requests the `https://example/original`, the actual content that will be served will be the one of
the `https://example/replacement` cached page.


By default, the plugin waits 10 secs for the Chrome-headless to load/render the page (before start checking periodically the content of the page for its
readiness through the Tracker/subscriptions statuses and then store the content).
This initial timeout can be changed through the checkAfterSeconds setting:
```js
   Meteor.settings.checkAfterSeconds = 10; 
 ```


To trigger the caching/re-caching of a page you call the following:
```js
// Server-side
import { Spiderable } from "meteor/artlimes:meteor-chrome-headless-spiderable";

Spiderable.makeCacheOfPage(urlPath);
```
Or by simply visiting the page you want(autocaching): `http://example.com/my-page?_escaped_fragment_=`

in order to disable the afforementioned autocaching behavior, use:
```js
Meteor.settings.spiderable.autocaching = false;
```


## Setup with Reaction Commerce
[Reaction Commerce](https://reactioncommerce.com) is the most advanced open-source e-commerce platform built on Meteor and Node. You can make use of this plugin, by installing the [Reaction Commerce Caching Plugin](https://github.com/artlimes/reaction-commerce-caching-plugin).


