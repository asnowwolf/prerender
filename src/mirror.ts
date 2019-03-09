import { Browser, launch, Response } from 'puppeteer';
import { basename, dirname, join } from 'path';
import { sync as mkdirp } from 'mkdirp';
import { chunk, differenceBy, uniq } from 'lodash';
import { writeFileSync } from 'fs';
import { MirrorParams } from './bin/commands/mirror';
import { htmlToMd } from './utils';

export class MirrorUtils {
  private requestedUrls: string[] = [];

  private readonly outDir: string;
  private readonly urls: string[];
  private readonly recursive: boolean;
  private readonly generateMd: boolean;
  private readonly selectors: string[];
  private blacklist: (RegExp | string)[] = [
    'https://platform.twitter.com/widgets.js',
  ];

  constructor(params: MirrorParams) {
    this.outDir = params.outDir;
    this.urls = params.urls;
    this.recursive = params.recursive;
    this.selectors = params.selectors;
    this.generateMd = params.generateMd;
  }

  async renderPage(browser: Browser, outDir: string, url: string) {
    if (this.requestedUrls.indexOf(url) !== -1) {
      return;
    }
    this.requestedUrls.push(url);
    const page = await browser.newPage();
    const responses: Response[] = [];
    await page.setRequestInterception(true);
    await page.setCacheEnabled(false);
    page.on('request', async (req) => {
      if (this.isBlocked(req.url())) {
        req.abort('blockedbyclient');
      } else {
        await req.continue();
      }
    });
    page.on('response', (resp) => {
      responses.push(resp);
    });
    page.on('requestfailed', (req) => {
      console.log(page.url(), req.url(), req.failure());
    });
    page.on('load', async () => {
      for (let i = 0; i < responses.length; ++i) {
        const resp = responses[i];
        if (resp.fromCache()) {
          console.error(resp.request().url() + ' is loaded from cache');
        }
        const request = resp.request();
        const url = request.url();
        // 不处理 data 协议
        if (new URL(url).protocol === 'data:') {
          return;
        }
        // 忽略跳转类协议
        if (resp.status() >= 300 && resp.status() < 400) {
          return;
        }
        // 忽略 404
        if (resp.status() === 404) {
          return;
        }
        const headers = resp.headers();
        const isHtml = (headers['content-type'] || '').indexOf('html') !== -1;
        const filename = fileNameOf(url, outDir, isHtml);
        saveUrl(filename, await resp.buffer());
      }
    });
    console.log('rendering ', url);
    await page.goto(url, { waitUntil: 'networkidle2' }).catch((e) => {
      console.error(url, e);
    });
    const content = await page.content();
    const filename = fileNameOf(url, outDir, true);
    saveUrl(filename, new Buffer(content, 'utf-8'));
    if (this.generateMd) {
      const contents = await page.evaluate((selectors: string[]) => {
        return selectors.map((selector) => {
          const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
          return elements.map(element => element.innerHTML);
        });
      }, [this.selectors]);

      const html = contents.reduce((acc, item) => [...acc, ...item], []).join('\n\n');
      mkdirp(dirname(filename));
      writeFileSync(replaceExtName(filename, '.md'), htmlToMd(html), 'utf-8');
    }
    if (this.recursive) {
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map(a => a.href);
      });
      await page.close();
      console.log(`rendered ${url}.`);
      const urlsInSubFolder = uniq(links.filter(link => this.inSubFolder(link)).map(majorPartOf));
      const nextUrls = differenceBy(urlsInSubFolder, this.requestedUrls, (url) => majorPartOf(url));
      await this.renderPageGroup(browser, outDir, nextUrls);
    } else {
      await page.close();
      console.log(`rendered ${url}.`);
    }
  }

  inSubFolder(link: string): boolean {
    return !!this.urls.find(url => link.startsWith(url));
  }

  async renderPageGroup(browser: Browser, outDir: string, urls: string[]) {
    for (let i = 0; i < urls.length; ++i) {
      await this.renderPage(browser, outDir, urls[i]);
    }
  }

  async mirror() {
    const browser = await launch({ defaultViewport: { width: 1280, height: 768 } });
    const groups = chunk(uniq(this.urls), 4);
    for (let i = 0; i < groups.length; ++i) {
      await this.renderPageGroup(browser, this.outDir, groups[i]).catch((e) => {
        console.log(e);
      });
    }
    await browser.close();
  }

  private isBlocked(url: string) {
    return !!this.blacklist.find(rule => {
      if (rule instanceof RegExp) {
        return rule.test(url);
      } else {
        return url === rule;
      }
    });
  }
}

function isNonExtHtmlFile(pathname: string): boolean {
  return !pathname.endsWith('.html') || !pathname.endsWith('.htm');
}

function isDirectory(pathname: string): boolean {
  return pathname.endsWith('/');
}

function fileNameOf(url: string, outDir: string, isHtml: boolean): string {
  const { host, pathname } = new URL(url);

  const decodedPathname = decodeURIComponent(pathname);

  if (isHtml && isNonExtHtmlFile(decodedPathname) || isDirectory(decodedPathname)) {
    return join(outDir, host, decodedPathname, 'index.html');
  }

  return join(outDir, host, decodedPathname);
}

function saveUrl(filename: string, buffer: Buffer): void {
  mkdirp(dirname(filename));
  writeFileSync(filename, buffer);
}

function replaceExtName(filename: string, dotPrefixedExtName: string): string {
  return join(dirname(filename), basename(filename, '.html') + dotPrefixedExtName);
}

function majorPartOf(url: string): string {
  return url.replace(/#.*$/, '').replace(/\/$/, '');
}
