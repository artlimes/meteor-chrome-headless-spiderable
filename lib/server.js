import urlParser      from "url";
import CDP            from "chrome-remote-interface";
import { Mongo }      from "meteor/mongo";
import { Meteor }     from "meteor/meteor";
import { WebApp }     from "meteor/webapp";
import { Spiderable } from "./spiderable.js";

const cacheCollection = new Mongo.Collection("SpiderableCacheCollection");

const chromeLauncher = require("chrome-launcher");
// useLocalChrome. If set to true, chrome is used with local installation of chrome, else a connection
// through network(docker) is assumed
// chromeIp/chromePort. used when useLocalChrome = false


// Default Spiderable options
const defaultOptions = {
  useLocalChrome : true,
  autocaching: true,
  ignoredRoutes : ["/assets/", "/sitemap.xml"],
  allowRedirects : true,
  chromeIp : "chrome-headless",
  chromePort: 9222,
  cacheLifetimeInMinutes : null,
  customQuery : "__isGettingPrerendered__",
  checkAfterSeconds: 10,
  urlPathReplacements: [],
  stripUrlQuery: false
};

Object.assign(Spiderable,defaultOptions);

Meteor.startup(() => {

  if (Meteor.settings.spiderable) {
    Object.assign(Spiderable, Meteor.settings.spiderable);
  }

  if (typeof Spiderable.useLocalChrome === "undefined") {
    Spiderable.useLocalChrome = true;
  }

  if (Spiderable.cacheLifetimeInMinutes !== null) {

    if (Spiderable.cacheLifetimeInMinutes === undefined) {
      Spiderable.cacheLifetimeInMinutes = 3 * 60;
    }

    if (typeof Spiderable.cacheLifetimeInMinutes !== "number") {
      throw new Meteor.Error("Bad Spiderable.cacheLifetimeInMinutes");
    }

    cacheCollection._ensureIndex({
      createdAt: 1
    }, {
      expireAfterSeconds: Spiderable.cacheLifetimeInMinutes * 60,
      background: true
    });
  }
});

cacheCollection._ensureIndex({
  hash: 1
}, {
  unique: true,
  background: true
});


Spiderable.userAgentRegExps = [
  /360spider/i,
  /adsbot-google/i,
  /ahrefsbot/i,
  /applebot/i,
  /baiduspider/i,
  /bingbot/i,
  /duckduckbot/i,
  /facebookbot/i,
  /facebookexternalhit/i,
  /google-structured-data-testing-tool/i,
  /googlebot/i,
  /instagram/i,
  /kaz\.kz_bot/i,
  /linkedinbot/i,
  /mail\.ru_bot/i,
  /mediapartners-google/i,
  /mj12bot/i,
  /msnbot/i,
  /msrbot/i,
  /oovoo/i,
  /orangebot/i,
  /pinterest/i,
  /redditbot/i,
  /sitelockspider/i,
  /skypeuripreview/i,
  /slackbot/i,
  /sputnikbot/i,
  /tweetmemebot/i,
  /twitterbot/i,
  /viber/i,
  /vkshare/i,
  /whatsapp/i,
  /yahoo/i,
  /yandex/i
];


const replaceUrlPath = (urlPath) => {
  if (!urlPath) return urlPath;

  if (Array.isArray(Spiderable.urlPathReplacements)) {
    Spiderable.urlPathReplacements.forEach(function ([from, to]){
      if (typeof from !== "string" || typeof to !== "string") return;
      urlPath = urlPath.replace(from,to);
    })
  }

  return urlPath;
};

const urlForChrome = (requestUrlPath) => {

  let urlObj;
  const reconstructedUrl = Meteor.absoluteUrl( (requestUrlPath === "/") ? requestUrlPath.substr(1) : requestUrlPath);
  if (Spiderable.stripUrlQuery) {
    const indexOfQuery = reconstructedUrl.indexOf("?");
    urlObj = (~indexOfQuery) ? urlParser.parse(reconstructedUrl.substr(0, indexOfQuery)) :
        urlParser.parse(reconstructedUrl);
  } else {
    urlObj = urlParser.parse(reconstructedUrl, true);
    delete urlObj.query._escaped_fragment_;
  }

  const customQuery = Spiderable.customQuery;
  if (customQuery && typeof customQuery === "string") {
    if (urlObj.query) {
      urlObj.query[customQuery] = "true";
    } else {
      urlObj.query = { [customQuery]: true }
    }
  }

  delete urlObj.search;
  delete urlObj.path;
  urlObj.pathname = replaceUrlPath(urlObj.pathname);

  return urlParser.format(urlObj);
};

function launchChrome() {
  return chromeLauncher.launch({
    port: Spiderable.port,
    chromeFlags: [
      '--disable-gpu',
      '--headless'
    ]
  });
};

const isReady = function () {
  if (typeof Meteor === "undefined"
      || Meteor.status === undefined
      || !Meteor.status().connected) {

    return false;
  }

  if (typeof Tracker === "undefined" || typeof DDP === "undefined") {
    return false;
  }

  Tracker.flush();
  if (!DDP._allSubscriptionsReady()) {
    return false;
  } else if (Spiderable.redirect) {
    return {redirectTo: Spiderable.redirect};
  }

  return true;
};

const checkIfReady = (Runtime, callback) => {
  const maxAttempts = 20;
  let attempts = 0;

  const _check = () => {
    attempts++;
    const runtime = Runtime.evaluate({ expression: `(${isReady.toString()})()` }).then((result) => {
      if (!result.result.value && attempts < maxAttempts) {
        setTimeout(_check, 1000);
      } else {
        callback();
      }
    });

    return runtime;
  };

  if (typeof Spiderable.checkAfterSeconds === "number") {
    setTimeout( _check, Spiderable.checkAfterSeconds);
  } else {
    _check();
  }
};

const getHtmlContent = Runtime => Runtime.evaluate({ expression: "document.documentElement.outerHTML" });

const pageCacher = async (url, hash, res) => {
  let succeeded = false;
  let chrome;
  if (Spiderable.useLocalChrome) {
    chrome = await launchChrome();
  }

  Meteor.setTimeout(() => {
    console.log("going to visit",url);
    console.log(url);
    const chromeParams = {};
    if (Spiderable.useLocalChrome) {
      chromeParams.port = chrome.port;
    } else {
      chromeParams.host = Spiderable.chromeIp;
      chromeParams.port = Spiderable.chromePort;
    }

    CDP(chromeParams, (protocol) => {
      // Extract the parts of the DevTools protocol we need for the task.
      // See API docs: https://chromedevtools.github.io/debugger-protocol-viewer/
      const {Page, Runtime} = protocol;
      // First, need to enable the domains we're going to use.
      Promise.all([
        Page.enable(),
        Runtime.enable()
      ]).then(() => {
        Page.navigate({url});


        // Wait for window.onload before doing stuff.
        Page.loadEventFired(() => {
          succeeded = true;
          checkIfReady(Runtime, () => {
            getHtmlContent(Runtime).then((result) => {
              let html = result.result.value;
              html = html.replace(/<script(?!([^>]*?)keep)(?:[^>]+?)>(.|\n|\r)*?<\/script\s*>/ig, "");
              html = html.replace('<meta name="fragment" content="!">', "");

              protocol.close();
              if (Spiderable.useLocalChrome) {
                chrome.kill();
                //chromeProcess.kill("SIGINT");
              }

              cacheCollection.upsert({
                hash: hash
              }, {
                "$set": {
                  hash: hash,
                  url: url,
                  // headers: output.headers,
                  // content: output.content,
                  // status: output.status,
                  content: html,
                  createdAt: new Date
                }
              });
              if (res) {
                res.writeHead(200, {"Content-Type": "text/html; charset=UTF-8"});
                res.end(html);
              }

            });
          });
        });
      });
    }).on("error", (err) => {
      // cannot connect to the remote endpoint
      console.error(err);
    });
  }, 100);
}


WebApp.connectHandlers.use((req, res, next) => {
  if ((/\?.*_escaped_fragment_=/.test(req.url) || Spiderable.userAgentRegExps.some(re => {
    return re.test(req.headers["user-agent"]);
  })) && Spiderable.ignoredRoutes.every(route => {
    return !req.url.includes(route);
  })) {

    Spiderable.originalRequest = req;
    const url = urlForChrome(req.url);
    const hash = new Buffer(url).toString("base64");

    const cached = cacheCollection.findOne({ hash });
    if (cached) {
      if (res) {
        res.writeHead(200, {"Content-Type": "text/html; charset=UTF-8"});
        res.end(cached.content);
      }
    } else if (Spiderable.autocaching) {
      pageCacher(url,hash,res);
    } else {
      res.writeHead(404, {"Content-Type": "text/plain"});
      res.write("404 Not Found\n");
      res.end();
    }
    return;
  }
  return next();
});


Spiderable.makeCacheOfPage = (urlPath) => {
  const url = urlForChrome(urlPath);
  const hash = new Buffer(url).toString("base64");
  pageCacher(url,hash);
};
