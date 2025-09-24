import chromium from '@sparticuz/chromium';
import type { Browser, LaunchOptions } from 'puppeteer-core';
import puppeteerCore from 'puppeteer-core';

export async function createBrowser(): Promise<Browser> {
  // Try serverless chromium first (Vercel/AWS Lambda)
  try {
    const executablePath = await chromium.executablePath();
    const browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      headless: chromium.headless,
      executablePath: executablePath || undefined,
    } as LaunchOptions);
    return browser;
  } catch (err) {
    // Fallback to full Puppeteer for local/dev environments
    const puppeteer = (await import('puppeteer')).default;
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    // Cast to core Browser type for interface compatibility
    return browser as unknown as Browser;
  }
}
