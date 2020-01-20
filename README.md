# Upgrade a web app into a PWA

To demonstrate this, I made a basic web app that fakes a chat using JSONPlaceholder. What it does is it requests the first 25 comments from this server.

Since it's not possible to actually create any new resource with this API, I'm faking this with a form that just adds the user's comment on top of the feed, provided we're not offline.

To fake the renewal of the feed, we can change the "start" command of the request. For example

```
fetch("https://jsonplaceholder.typicode.com/comments?_start=5&_limit=15")
```

will still display 15 comments, only starting with the fifth.

The goal here is to make a Progressive Web App out of this basic web app.

This tutorial is based on [this course](https://www.udemy.com/course/progressive-web-apps/), which taught me all the steps to achieve this goal.

## Table of Contents

1. **[Adding a Service Worker](#Adding-a-Service-Worker)**
2. **[Caching Dynamic Content](#Caching-Dynamic-Content)**
3. **[Managing Cache Storage](#Managing-Cache-Storage)**
4. **[Adding a Manifest](#Adding-a-Manifest)**

---

## Adding a Service Worker

- At the project's root, create the sw.js file

- Create the 'version' variable, to allow updating

  ```
  const version = '1.0';
  ```

- Create an array of static assets to cache when this worker is installed -> this is the app shell

  ```
  const appAssets = [
      'index.html',
      'main.js',
      "images/logo.png",
      "vendor/bootstrap.min.css",
      "vendor/jquery.min.js"
  ];
  ```

- Create an 'install listener' that will wait until creating a new cache store for this worker,
  then add all the app assets to it

  ```
  self.addEventListener('install', e => {
      e.waitUntil(
          caches.open(`static-${version}`)
              .then(cache => cache.addAll(appAssets))
      );
  });
  ```

- Create an 'activate listener' that will clean any old version of the static cache

  ```
  self.addEventListener('activate', e => {
      let cleaned = caches.keys().then( keys => {
          keys.forEach(key => {
              if (key !== `static-${version}` && key.match('static-')) {
                  return caches.delete(key);
              }
          });
      });
      e.waitUntil(cleaned);
  });
  ```

- Back in main.js, register this worker (checking first that the browser supports service workers)

  ```
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
  ```

- Test at this point -> in the inspector -> application -> service workers -> reload the app.
  The service worker should install successfully. In cache storage, 'static-1.0' has been created.

- In sw.js, add a fetch listener that will serve the app shell from the cache. It needs a condition that will check that the fetch is about an app shell ressource before attempting to serve it from the cache.

  ```
  // SW Fetch
  self.addEventListener('fetch', e => {
      // App shell
      if(e.request.url.match(location.origin)) {
          e.respondWith(staticCache(e.request));
      }
  });
  ```

- Now go back above the fetch listener and create the static cache strategy, in this case a very basic 'cache with network fallback' strategy

  ```
  // Static cache strategy - Cache with Network Fallback
  const staticCache = (req) => {
      return caches.match(req).then(cachedRes => {
          // Return cached response if found
          if(cachedRes) return cachedRes;
          // Fall back to network
          return fetch(req).then (networkRes => {
              // Update cache with new response
              caches.open(`static-${version}`)
                  .then(cache => cache.put(req, networkRes));
              // Return Clone of Network Response
              return networkRes.clone();
          });
      });
  };
  ```

- Let the new worker install (skip waiting). Reload, then go offline (checkbox in 'service workers'), reload again and the app shell should load perfectly with only the API requests failing.

### At this point I already have an app that doesn't feel like a website anymore, with all its assets loading instantly and being accessible offline.

**[⬆ back to top](#table-of-contents)**

---

## Caching Dynamic Content

- Back in the fetch listener, add an "else if" to match any requests to the API:

  ```
    // JSONPlaceholder API
    else if (e.request.url.match('jsonplaceholder.typicode.com/comments')) {
        e.respondWith(fallbackCache(e.request));
    }
  ```

- Above the fetch listener, below the first cache strategy (cache with network fallback), let's implement a new strategy that will always try the network first, and if that fails or isn't available, go to the last successful request in the cache, as a fallback. Of course the cache needs to be updated every time this request succeeds.

  ```
  // Network with Cache Fallback
  const fallbackCache = req => {
      // Try Network
      return (
          fetch(req)
              .then(networkRes => {
                  // Check res is OK, else go to cache
                  if (!networkRes.ok) throw "Fetch Error";
                  // Update cache
                  caches
                      .open(`static-${version}`)
                      .then(cache => cache.put(req, networkRes));
                  // Return Clone of Network Response
                  return networkRes.clone();
              })
      // Try cache
      .catch(err => caches.match(req))
      );
  };
  ```

- Test this new strategy. Let the service worker update (skip waiting), reload to have this API request go via the new worker. Now the request is stored in the cache storage. Go offline, reload, and the feed is still there. It is now served from the cache.

- Now let's say I also want to have pictures displayed (as the chat users' profile pics, for example), and to cache them as well. Make a change in main.js to assign a picture from _**Lorem Picsum**_ to each comment

  <pre>
  // Get template
  const template = document.querySelector("#template");
  <b>let picCount = 1;</b>
  
  // DISPLAY FEED
  // GET request using fetch()
  fetch("https://jsonplaceholder.typicode.com/comments")
      // Converting received data to JSON
      .then(response => response.json())
      .then(json => {
          // Loop through each data and add a card
          json.forEach(comment => {
            const clone = document.importNode(template.content, true);
            clone.querySelector("#name").innerText = comment.name;
            clone.querySelector("#email").innerText = comment.email;
            clone.querySelector("#text").innerText = comment.body;
            <b>// Add a pic from lorem picsum
            let url = "https://picsum.photos/id/" + picCount + "/70";
            clone.querySelector("img").setAttribute("src", url);</b>
            // Push card on top of the feed
            comments.insertBefore(clone, comments.firstChild);
            <b>picCount += 10;</b>
          });
      });
  </pre>

- Then in sw.js, add another "else if" in the fetch listener:
  ```
  // Pics
  else if (e.request.url.match("picsum.photos/")) {
      e.respondWith(staticCache(e.request));
  }
  ```

I am using the static cache strategy again, because it's perfect for this type of resources that will never need updating (the pic with a given ID will always be the same pic). But there is a problem: every time I'll update the service worker, I'll lose every pic in the static cache - since it is cleaned at every activation of a new worker.

That didn't matter for the comments, because this is a chat I am faking. In reality the feed would be regularly renewed, displaying only the 15 most recent messages - and there would be no point in storing the old ones forever. However, as I'm assuming the messages will all proceed from the same lot of users, it does seem relevant to store the placeholders that I'm using as their profile pics. So let's adress that issue:

- Pass a second argument to the staticCache method, specifying a different cache to use

  <pre>
  // Pics
  else if (e.request.url.match("picsum.photos/")) {
      e.respondWith(staticCache(e.request, <b>'pics'</b>));
  }
  </pre>

- Then add it to the staticCache function, with a default value of the original static cache (`static-${version}`)

  <pre>
  // Static cache startegy - Cache with Network Fallback
  const staticCache = <b>(req, cacheName = `static-${version}`)</b> => {
      return caches.match(req).then(cachedRes => {
          // Return cached response if found
          if (cachedRes) return cachedRes;
          // Fall back to network
          return fetch(req).then(networkRes => {
          // Update cache with new response
          caches.open(<b>cacheName</b>).then(cache => cache.put(req, networkRes));
          // Return Clone of Network Response
          return networkRes.clone();
          });
      });
  };
  </pre>

So I'll now have all my pics cached, but in a separate cache that will not be cleaned when the service worker updates. (Let's change the version to 1.1 while we're at it)

Skip waiting to update the service worker, reload.

**[⬆ back to top](#table-of-contents)**

---

## Managing Cache Storage

Now just because I don't want all my pics erased from the cache at every update of the worker doesn't mean I want to store every pic that has ever been displayed on the app. That would be a waste of storage space.

So what I need, ideally, is to compare the pics that are going to be displayed in the feed with the pics I have in cache, and only remove those that don't match.

- Create a function in sw.js, above the fetch listener

  ```
  // Clean old pics from the 'pics' cache
  const cleanPicsCache = pics => {
      caches.open("pics").then(cache => {
          // Get all cache entries
          cache.keys().then(keys => {
              // Loop entries (requests)
              keys.forEach(key => {
                  // If entry is NOT part of current pics, delete
                  if (!pics.includes(key.url)) cache.delete(key);
              });
          });
      });
  };
  ```

- As I will be compiling the array of currently used pics in main.js, I'll have to invoke this function from main.js, once the entire request has been received and the results updated in index.html. To that end, I need to add a message listener in sw.js:

  ```
  // Listen for message from client
  self.addEventListener("message", e => {
      // Identify the message
      if (e.data.action === "cleanPicsCache") cleanPicsCache(e.data.pics);
  });
  ```

- In main.js, first create the array of currently used pics (after picCount)

  ```
  // Populate array of latest pics
  let latestPics = [];
  ```

- Then inside the loop where pics are assigned to comments, add each url to the array

  <pre>
  // Loop through each data and add a card
  json.forEach(comment => {
      const clone = document.importNode(template.content, true);
      clone.querySelector("#name").innerText = comment.name;
      clone.querySelector("#email").innerText = comment.email;
      clone.querySelector("#text").innerText = comment.body;
      // Add a pic from lorem picsum
      let url = "https://picsum.photos/id/" + picCount + "/70";
      clone.querySelector("img").setAttribute("src", url);
      <b>// Add to latest pics
      latestPics.push(url);</b>
      // Push card on top of the feed
      comments.insertBefore(clone, comments.firstChild);
      picCount += 10;
      });
  </pre>

- After the catch, call the function that will send this message to the worker. Since this is only of use if the browser supports service workers, let's check that first.

  ```
  .then(function() {
      // Inform the SW (if available) of current pics
      if (navigator.serviceWorker) picsCacheClean(latestPics);
  });
  ```

- Define that function at the top of main.js, inside the "progressive enhancement" conditional

  ```
  // Pics cache clean
  function picsCacheClean(pics) {
      // Get service worker registration
      navigator.serviceWorker.getRegistration().then(function(reg) {
          // Only post message to active SW
          if (reg.active)
            reg.active.postMessage({
              action: "cleanPicsCache",
              pics: pics
            });
        });
  }
  ```

- And to test this, let's change the increment of picCount at the end of the loop, from 10 to 11, so that every pic but the first will change. Also change the service worker version to 1.2. Let it install (skip waiting), reload, refresh caches. There are still only 15 pics in the pics cache, but 14 of them have changed.

### With the service worker now caching, serving and managing all of the app content, the only thing left to do is adding a Manifest, and this will truely be a PWA.

**[⬆ back to top](#table-of-contents)**

---

## Adding a Manifest
