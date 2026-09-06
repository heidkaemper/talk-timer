# Talk Timer

A timer for giving talks: large elapsed time, a minute bar, and the screen stays on.
Runs in the browser or installed on the home screen, offline included.

https://heidkaemper.github.io/talk-timer/

## Run locally

Static files, no build step. Serve them locally with anything:

```
npx --yes serve .
```

## Heads up

After changing `app.js`, `app.css` or `index.html`, bump the cache version in `sw.js` —
otherwise the service worker keeps handing out the old files.
