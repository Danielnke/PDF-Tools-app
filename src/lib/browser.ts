import chromium from '@sparticuz/chromium';
import type { Browser, LaunchOptions } from 'puppeteer-core';
import puppeteerCore from 'puppeteer-core';

async function tryRemote(): Promise<Browser | null> {
  const ws = process.env.BROWSER_WS_ENDPOINT || (process.env.BROWSERLESS_TOKEN ? `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}` : null);
  if (!ws) return null;
  return puppeteerCore.connect({ browserWSEndpoint: ws });
}

async function tryChromium(): Promise<Browser | null> {
  try {
    const executablePath = await chromium.executablePath();
    if (!executablePath) return null;
    return await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      headless: chromium.headless,
      executablePath,
    } as LaunchOptions);
  } catch {
    return null;
  }
}

export async function createBrowser(): Promise<Browser> {
  const remote = await tryRemote();
  if (remote) return remote;

  const local = await tryChromium();
  if (local) return local;

  throw new Error('No Chrome available: set BROWSER_WS_ENDPOINT or deploy where @sparticuz/chromium is supported.');
}
