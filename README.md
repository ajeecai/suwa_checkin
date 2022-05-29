# suwa auto checkin

## Background

Recently I created an account in suwa, with a small quota of data. But everyday checkin will additionally give me several hundred MB for free.

So I like to do it automatically. It took me a weekend to wrap up this with [playwright](https://github.com/microsoft/playwright). Playwright is awesome, although I am new to it but easy to write with it. Compared to [puppeteer](https://github.com/puppeteer/puppeteer), it is obvious that playwright is much better and well-documented.

During the login, suwa requires to move a slider for verification. I choose to do it in pure front-end without installing heavy opencv related libs in backend. So the code will rely on [opencv.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html), in this experiment, opencv 4.5.5 works better than 5.x dev version.

## How to run

- make sure in your home directory, there is a file named `suwa_credential.txt`, with user name in first line and password in second line.

- run in headless mode:

```
npx playwright test
```

or headed mode for debug, with xming setup correctly if you have no GUI in the server where it runs:

```
npx playwright test --headed
```

Of course, need to put it into crontab if run it periodically.

## Screenshot

This is one of screenshots, the canvas for edges is not necessary, only show it for visual looks.

![screenshot](./assets/suwa.png)

## Knowledge

Want to share what I learn from this test.

- `selector` syntax in playwright is almost the same as that of css selector.

- `evaluate` in playwright runs the pageFunction in browser context, **not** in node context. This bothers me much at the very beginning. With the imported several opencv js bindings, like [this](https://github.com/theothergrantdavidson/opencv-ts) and [this](https://github.com/TechStark/opencv-js), use cv in pageFunction, in runtime `xxx is not defined` is seen. So official opencv.js is passed as a string parameter into pageFunction, it is size of 8M+, currently it is fine until it becomes huge in the future :). You may notice that inside evaluate pageFunction, there are no types, considering the types in aforesaid third-party wrappers may not be consistent with what I actually use in pageFunction.

- The same, `console.log` in evaluate pageFunction could not print well to node console, unless it is run in headed mode and check it in browser dev console. Use `page.on("console",...)` is better but still could not get the object printed, instead, the output is something like `src is {}`.

Maybe I miss something so that it works like this, but I hope this could help other guys who encounter the similar issues.
