import puppeteer from "npm:puppeteer";
import chalk from "npm:chalk";
import { config } from "../utils/config.ts";

export const applyActivityToNumber = async (
  date: Date,
  number: string,
  cookie: string,
  content: string,
  time?: string,
  onStatusUpdate?: (msg: string) => void, // added callback parameter
) => {
  if (Deno.args[0] === "noupload") {
    onStatusUpdate?.("Not uploading data, saving local...");
    console.log("Not uploading data, saving local...");
    await Deno.writeTextFile(
      `${date.toLocaleDateString("de-DE")}-${Deno.args[1] ?? "log"}.log`,
      decodeURI(content),
    );
    onStatusUpdate?.("Data saved!");
    console.log(chalk.green("Data saved!"));
    return;
  }
  onStatusUpdate?.("Starting upload...");
  const forDate = formatDateToYYYYMMDD(date);
  const formData = new FormData();
  formData.set("disablePaste", "0");
  formData.set("Seq", "0");
  formData.set("Art_ID", "20");
  formData.set("Abt_ID", "0");
  formData.set("Dauer", time ?? "40:00");
  formData.set("Inhalt", content);
  formData.set("jsVer", "12");
  const response = await fetch(
    `https://www.azubiheft.de/Azubi/XMLHttpRequest.ashx?Datum=${forDate}&BrNr=${number}&BrSt=0&BrVorh=Yes&T=${
      Math.floor(Date.now() / 1000)
    }`,
    {
      "headers": {
        "accept": "*/*",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": '"Not?A_Brand";v="99", "Chromium";v="130"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-my-ajax-request": "ajax",
        "cookie": cookie,
        "Referer": "https://www.azubiheft.de/",
        "Referrer-Policy": "origin",
      },
      "body": formData,
      "method": "POST",
    },
  );
  const statusMsg = `Status: ${response.ok ? "Ok" : "Error"}`;
  onStatusUpdate?.(statusMsg);
  console.log(chalk.green(statusMsg));
};

const formatDateToYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const extractNumber = (text: string) => {
  const match = text.match(/\b\d+\b/); // Looks for a whole number in the text
  return match ? match[0] : null; // Returns the number or null if no match
};

export const getWeekNumberForDateAndCookie = async (
  date: Date,
  shouldDelete: boolean,
  onStatusUpdate?: (msg: string) => void, // added callback parameter
) => {
  const fmtDate = formatDateToYYYYMMDD(date);
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    onStatusUpdate?.("Launched browser.");
  } catch (_error) {
    onStatusUpdate?.("Puppeteer not found, installing...");
    const installCommand = new Deno.Command("npx", {
      args: ["puppeteer@23.7.1", "browsers", "install", "chrome"],
    });
    await installCommand.output();
    browser = await puppeteer.launch();
    onStatusUpdate?.("Launched browser after installation.");
  }
  const page = await browser.newPage();
  onStatusUpdate?.("Navigating to login page...");
  await page.goto("https://www.azubiheft.de/Login.aspx");
  await page.type("#txt_Benutzername", config.ah_username);
  await page.type("#txt_Passwort", config.ah_password);
  const submit = await page.waitForSelector(
    '[name="ctl00$ContentPlaceHolder1$cmd_Login"]',
  );
  await submit?.click();
  onStatusUpdate?.("Logging in...");
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  await page.goto(
    `https://www.azubiheft.de/Azubi/Tagesbericht.aspx?Datum=${fmtDate}&T=1730815306864A`,
  );
  onStatusUpdate?.("Fetching week number info...");
  const heading = await page.$eval("#lbl_Datum", (el) => el.innerText);
  if (shouldDelete) {
    await page.$$eval('[data-wb="divWB20"]', (els) => {
      const el = els[els.length - 1];
      if (el.innerText !== "") {
        el.click();
      }
    });
    await page.$eval("#cmdDel", (el) => el.click());
    await page.$eval("#cmdConfirmBoxOK", (el) => el.click());
    onStatusUpdate?.("Deleted existing entry.");
  }
  const cookies = await page.cookies();
  const number = extractNumber(heading);
  await page.close();
  await browser.close();
  onStatusUpdate?.("Closed browser and returning week data.");
  return {
    number,
    cookies: cookies.map((cookie) => `${cookie.name}=${cookie.value};`).join(
      " ",
    ),
  };
};
