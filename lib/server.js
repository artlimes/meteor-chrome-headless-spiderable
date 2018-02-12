import child          from "child_process";
import urlParser      from "url";
import querystring    from "querystring";
import CDP            from "chrome-remote-interface";
import { _ }          from "meteor/underscore";
import { Mongo }      from "meteor/mongo";
import { Meteor }     from "meteor/meteor";
import { WebApp }     from "meteor/webapp";
import { Spiderable } from "./spiderable.js";

const cacheCollection = new Mongo.Collection("SpiderableCacheCollection");


// useLocalChrome. If set to true chrome is used with local installation of chrome, else a connection
// through network(docker) is assumed
// chromeIp. used when useLocalChrome = false
// chromePath. used when useLocalChrome = true


// Default Spiderable options
const defaultOptions = {
  useLocalChrome : true,
  ignoredRoutes : ["/assets/", "/sitemap.xml"],
  allowRedirects : true,
  chromePath: "google-chrome",
  chromeIp : "chrome-headless",
  cacheLifetimeInMinutes : null,
  customQuery : "__isGettingPrerendered__",
  checkAfterSeconds: 10,
  urlPathReplacements: []
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

    if (!_.isNumber(Spiderable.cacheLifetimeInMinutes)) {
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


const urlForChrome = (siteAbsoluteUrl, requestUrl) => {
  const urlAfterReplacement = replaceUrlPath(requestUrl);

  const parsedUrl = urlParser.parse(urlAfterReplacement);
  const parsedQuery = querystring.parse(parsedUrl.query);
  const escapedFragment = parsedQuery._escaped_fragment_;
  delete parsedQuery._escaped_fragment_;

  if (Spiderable.customQuery && _.isString(Spiderable.customQuery)) {
    parsedQuery[Spiderable.customQuery] = "true";
  }

  const parsedAbsoluteUrl = urlParser.parse(siteAbsoluteUrl);
  if (parsedUrl.pathname.charAt(0) === "/") {
    parsedUrl.pathname = parsedUrl.pathname.substring(1);
  }

  parsedAbsoluteUrl.pathname = urlParser.resolve(parsedAbsoluteUrl.pathname, parsedUrl.pathname);
  parsedAbsoluteUrl.query = parsedQuery;
  parsedAbsoluteUrl.search = null;
  if (escapedFragment && escapedFragment.length > 0) {
    parsedAbsoluteUrl.hash = "!" + decodeURIComponent(escapedFragment);
  }
  return urlParser.format(parsedAbsoluteUrl);
};

const replaceUrlPath = (url) => {
  if (Array.isArray(Spiderable.urlPathReplacements)) {
    for (replacement of Spiderable.urlPathReplacements){
      const from = replacement[0];
      const to = replacement[1];
      if (typeof from !== "string" || typeof to !== "string") {
        continue;
      }

      if (~url.indexOf(from)) {
        return url.replace(from,to);
      }
    }
  }

  return url;
};

function launchChrome() {
  return child.spawn(`${Spiderable.chromePath}`, ["--headless", "--disable-gpu", "--remote-debugging-port=9222", "--no-sandbox"]);
}

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

  if (_.isNumber(Spiderable.checkAfterSeconds)) {
    setTimeout( _check, Spiderable.checkAfterSeconds);
  } else {
    _check();
  }
};

const getHtmlContent = Runtime => Runtime.evaluate({ expression: "document.documentElement.outerHTML" });

const pageCacher = (url, hash, res) => {
  let succeeded = false;

  let chromeProcess;
  if (Spiderable.useLocalChrome) {
    chromeProcess = launchChrome();
    chromeProcess.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
      if (!succeeded && res) {
        res.writeHead(500, {"Content-Type": "text/html; charset=UTF-8"});
        res.end("could not render page");
      }
    });

    chromeProcess.on("error", (error) => {
      console.log("child process exited with error", error);
      if (!succeeded && res) {
        res.writeHead(500, {"Content-Type": "text/html; charset=UTF-8"});
        res.end("could not render page", error.message);
      }
      chromeProcess.kill("SIGINT");
    });
  }

  Meteor.setTimeout(() => {
    console.log("going to visit",url);
    console.log(url);
    const chromeParams = {};
    if (!Spiderable.useLocalChrome) {
      chromeParams.host = Spiderable.chromeIp;
    }

    CDP(chromeParams ,(protocol) => {
      // Extract the parts of the DevTools protocol we need for the task.
      // See API docs: https://chromedevtools.github.io/debugger-protocol-viewer/
      const { Page, Runtime } = protocol;
      // First, need to enable the domains we're going to use.
      Promise.all([
        Page.enable(),
        Runtime.enable()
      ]).then(() => {
        Page.navigate({ url });


        // Wait for window.onload before doing stuff.
        Page.loadEventFired(() => {
          succeeded = true;
          checkIfReady(Runtime, () => {
            getHtmlContent(Runtime).then((result) => {
               let html = result.result.value;
               html = html.replace(/<script[^>]+>(.|\n|\r)*?<\/script\s*>/ig, "");
               html = html.replace('<meta name="fragment" content="!">', "");

               protocol.close();
               if (Spiderable.useLocalChrome) {
                 chromeProcess.kill("SIGINT");
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
  if ((/\?.*_escaped_fragment_=/.test(req.url) || _.any(Spiderable.userAgentRegExps, (re) => {
      return re.test(req.headers["user-agent"]);
    })) && !_.any(Spiderable.ignoredRoutes, (route) => {
      return req.url.indexOf(route) > -1;
    })) {
    Spiderable.originalRequest = req;

    const url = urlForChrome(Meteor.absoluteUrl(), req.url);

    const hash = new Buffer(url).toString("base64");
    const cached = cacheCollection.findOne({
      hash: hash
    });

    if (cached) {
      if (res) {
        res.writeHead(200, {"Content-Type": "text/html; charset=UTF-8"});
        res.end(cached.content);
      }
    } else {
      pageCacher(url,hash,res);
    }
    return;
  }
  return next();
});


Spiderable.makeCacheOfPage = (urlPath) => {
  if (urlPath === "") {
    urlPath = "/";
  }

  const url = urlForChrome(Meteor.absoluteUrl(), urlPath);
  const hash = new Buffer(url).toString("base64");
  pageCacher(url,hash);
};
