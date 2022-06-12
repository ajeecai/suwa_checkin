import { test } from "@playwright/test";
import * as fs from "fs";
import os from "os";
// import cv from "opencv-ts";
// import _cv, { CV } from "@techstark/opencv-js";

test("suwa", async ({ page }) => {
  // test.setTimeout(120 * 1000);
  const MAX_LOGIN_CNT = 10;

  let figure_num = 0;
  const scDir = "./screenshot/";

  function prefix(name: string) {
    let str = scDir + figure_num.toString().padStart(2, "0") + "_" + name;
    figure_num++;
    return str;
  }
  function rmPng(f?: boolean) {
    let forced = f;
    if (figure_num > 100) {
      forced = true;
    }
    if (!forced) {
      return;
    }

    fs.readdirSync(scDir).forEach((file) => {
      if (file.endsWith(".png")) {
        // delete file
        fs.unlinkSync(scDir + file);
      }
    });
  }
  async function delay(t?: number) {
    let delayTime = 1000;
    if (t) {
      delayTime = t;
    }
    // ctrl key won't bring any side effect
    await page.keyboard.press("Control", { delay: delayTime });
  }

  if (!fs.existsSync(scDir)) {
    fs.mkdirSync(scDir);
  }
  rmPng(true);

  const userHomeDir = os.homedir();
  const fileContent = fs.readFileSync(userHomeDir + "/suwa_credential.txt");
  if (!fileContent) {
    console.error("Could not read credential");
    return;
  }
  const creds = fileContent.toString().split("\n");
  // console.log("username is ", creds[0], ",password is ", creds[1]);
  await page.goto("https://cloud.faster.buzz/m/login");
  await page.screenshot({ path: prefix(`login_page.png`) });
  await page.fill('input[name="email"]', creds[0]);
  await page.fill('input[name="passwd"]', creds[1]);
  await page.screenshot({ path: prefix(`fill_in.png`) });
  await page.click("text=登录");

  const bgImg = (await page.locator(".bgImg").getAttribute("src")).substring(
    "data:image/png;base64,".length
  );
  await page.screenshot({ path: prefix(`cred_submit.png`) });

  const puImg = (
    await page.locator(".puzzleImg").getAttribute("src")
  ).substring("data:image/png;base64,".length);

  // const bgBuff = Buffer.from(bgImg, "base64");
  // const puBuff = Buffer.from(bgImg, "base64");
  // fs.writeFileSync("bgImg.png", bgBuff);
  // fs.writeFileSync("puImg.png", puBuff);

  page.on("console", async (msg) => {
    const values = [];
    for (const arg of msg.args()) {
      values.push(await arg.jsonValue());
    }
    console.log(...values);
  });

  const cv_content = fs.readFileSync("./tests/opencv.js", "utf-8");

  // pass 8M+ content of opencv.js as a parameter
  await page.evaluate((cv_content) => {
    // opencv
    let o = document.createElement("script");
    o.type = "text/javascript";
    // s.src = "https://docs.opencv.org/4.5.5/opencv.js";
    var code = "var myBgImg;\n" + cv_content;

    o.appendChild(document.createTextNode(code));
    document.head.appendChild(o);
  }, cv_content);

  // workaround to delay some time, let opencv js in browser to initiate,
  await delay();

  let loginOK = false;
  let loginCount = 0;

  while (!loginOK && loginCount < MAX_LOGIN_CNT) {
    console.log("loginCount ", loginCount);
    loginCount++;

    await page.locator(".bgImg").evaluate((node) => {
      console.log("add canvas");
      // canvas
      let s = document.getElementsByClassName("slideCaptchaContainer ")[0];
      if (!document.getElementById("canvas_bg")) {
        let b = document.createElement("canvas");
        b.id = "canvas_bg";
        s.appendChild(b);
      }
      if (!document.getElementById("canvas_notch")) {
        let n = document.createElement("canvas");
        n.id = "canvas_notch";
        s.appendChild(n);
      }

      console.log("before bgImage imread");
      // let cv: CV = (window as any).cv;

      // This cv is from brower context, not in node context
      const cv = (window as any).cv;
      const img = cv.imread(node as HTMLElement);
      let rows = img.rows;
      let cols = img.cols;
      console.log("width/height=", rows, cols);

      const imgGray = new cv.Mat();
      cv.cvtColor(img, imgGray, cv.COLOR_BGR2GRAY);
      console.log("after cvtColor");
      const imgBlur = new cv.Mat();
      let ksize = new cv.Size(3, 3);
      cv.GaussianBlur(imgGray, imgBlur, ksize, 0, 0, cv.BORDER_DEFAULT);
      const edges = new cv.Mat();
      // cv.Canny(imgGray, edges, 30, 100);
      cv.Canny(imgBlur, edges, 30, 100);
      console.log("after Canny");

      // save img into runtime var
      (window as any).myBgImg = edges;
      cv.imshow("canvas_bg", edges);
    });

    let p = await page.locator(".puzzleImg").evaluate((node) => {
      console.log("before puzzleImg imread");
      // let cv: CV = (window as any).cv;
      const cv = (window as any).cv;
      const img = cv.imread(node as HTMLElement);
      let rows = img.rows;
      let cols = img.cols;
      console.log("width/height=", rows, cols);

      const imgGray = new cv.Mat();
      cv.cvtColor(img, imgGray, cv.COLOR_BGR2GRAY);
      console.log("after cvtColor");
      const edges = new cv.Mat();
      cv.Canny(imgGray, edges, 100, 100);
      console.log("after Canny");

      cv.imshow("canvas_notch", edges);

      // Now compare the notch against bg
      let src = (window as any).myBgImg;
      let dst = new cv.Mat();
      let templ = edges;
      let mask = new cv.Mat();
      console.log("src is ", src);
      cv.matchTemplate(src, edges, dst, cv.TM_CCOEFF, mask);
      let result = cv.minMaxLoc(dst, mask);
      let maxPoint = result.maxLoc;

      let color = new cv.Scalar(255, 0, 0, 0);
      let point = new cv.Point(
        maxPoint.x + templ.cols,
        maxPoint.y + templ.rows
      );
      cv.rectangle(src, maxPoint, point, color, 2, cv.LINE_8, 0);
      cv.imshow("canvas_bg", src);

      return maxPoint.x;
    });

    // If select for slide image, use img[src="/m/assets/arrow-right.8022e282.svg"],
    // looks like it doesn't support regular exp such as [src~="arrow"]
    const slider = await page.locator(".slider").boundingBox();
    console.log("slider is ", slider);

    await page.screenshot({ path: prefix(`canvas_show.png`) });

    await page.mouse.move(slider.x + slider.width / 2, slider.y);

    await page.mouse.down({ button: "left" });
    await page.mouse.move(slider.x + slider.width / 2 + p, slider.y);

    // let's take a photo :)
    await page.screenshot({ path: prefix(`move_slider.png`) });

    await page.mouse.up();

    // wait for the page loaded, then go on or do again, depending on where the page is
    await delay();
    loginOK = await page.locator(".bgImg,.MuiAvatar-img").evaluate((node) => {
      const srcAttr = node.getAttribute("src");
      if (srcAttr.includes("image")) {
        console.log("login failed");
        return false;
      } else {
        console.log("login successfully");
        return true;
      }
    });

    if (!loginOK) {
      rmPng();
    }
  } // while for !loginOK

  if (!loginOK && loginCount == MAX_LOGIN_CNT) {
    console.error("failed");
    return;
  }

  // await page.locator("button:has(span)").click();
  // await page.locator("button:has(span) .MuiButton-label").click();
  // await page
  //   .locator("button:has-text('确定'),button:has-text('签到')")
  //   .evaluate((node) => {});
  // await page.locator("button:has-text('确定')").click();

  const buttons = page.locator("button");
  const count = await buttons.count();
  for (let i = 0; i < count; ++i) {
    const button = buttons.nth(i);
    const text = await buttons.nth(i).textContent();
    console.log("#", i, " ", text);
    if (text == "确定") {
      console.log("there is an anouncement popup, click it");
      await button.click();
    }
  }

  await page.locator("button", { hasText: "签到" }).click();

  // Let's take a photo
  await delay();
  await page.screenshot({ path: prefix(`mission_done.png`) });

  // await page.pause();

  console.log("done");
});
