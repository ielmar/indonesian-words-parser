import "dotenv/config";
import express, { Express, Request, Response } from "express";
import puppeteer, { KnownDevices } from "puppeteer";
import fs from "fs";

const app: Express = express();

const port = process.env.PORT || 3000;
const iPhone = KnownDevices["iPhone 8"];

let currentPageNo: number = 0;
let isRunning: boolean = false;
let isFinished: boolean = false;
const isHeadless: boolean | "new" | undefined =
  process.env.IS_HEADLESS == null || process.env.IS_HEADLESS === "old"
    ? false
    : "new";
const numberOfPages = 106;

app.get("/", async (req: Request, res: Response) => {
  return res.json({
    message: isRunning
      ? `Currently on page ${currentPageNo} of ${numberOfPages}`
      : "Not running",
  });
});

app.get("/download", (req: Request, res: Response) => {
  if (isRunning) {
    return res.json({
      message: "Still running",
    });
  } else if (isFinished) {
    const file = `${__dirname}/id.dictionary.txt`;
    res.download(file);
  } else {
    res.json({
      message: "Not finished",
    });
  }
});

app.get("/start", async (req: Request, res: Response) => {
  if (isRunning) {
    return res.json({
      message: "Already running",
    });
  }

  try {
    const browser = await puppeteer.launch({
      headless: isHeadless,
      slowMo: 50,
      args: [
        "--no-sandbox",
        // "--window-size=1024,728",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    // set viewport
    await page.setViewport({
      width: 300,
      height: 768,
      deviceScaleFactor: 1,
      isMobile: true,
    });

    // emulate iPhone 8
    await page.emulate(iPhone);

    page.setDefaultNavigationTimeout(90000);

    await page.setJavaScriptEnabled(false);

    isRunning = true;
    // res.redirect("/");

    // it has 106 pages if we start from the alphabet a
    for (let i = 1; i <= numberOfPages; i++) {
      currentPageNo = i;
      const linkToScrape = `${process.env.SCRAPE_URL}?page=${i}`;

      await page.goto(linkToScrape, { waitUntil: "networkidle2" });

      // wait for the content
      await page.waitForSelector(".row");

      // get all the words in the page
      const words = await page.evaluate((selector) => {
        const anchors_node_list = document.querySelectorAll(selector);
        const anchors = [...(anchors_node_list as any)];
        return anchors.map((link) =>
          link.innerText.includes(" ")
            ? link.innerText.split(" ")[0]
            : link.innerText
        );
      }, ".col-md-2 > ul > li");

      const word_string = words.join("\n") + "\n";

      fs.writeFile(
        "id.dictionary.txt",
        word_string,
        { flag: "a+" },
        (err) => err && console.log("Error writing file", err)
      );

      console.log(`Page ${i} of ${numberOfPages} done`);

      await page.waitForTimeout(10000);
    }

    await browser.close();
    isFinished = true;
    console.log("Browser Closed");
  } catch (err) {
    console.log(err);
    console.log("Browser Closed");
    res.json({
      message: "Some error occurred",
    });
  }
});

app.listen(port, () =>
  console.log(`Data scraper app listening on port ${port}!`)
);
