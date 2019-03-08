import { Browser, launch, Response } from 'puppeteer';
import { basename, dirname, join } from 'path';
import { sync as mkdirp } from 'mkdirp';
import { chunk, difference, uniq } from 'lodash';
import { writeFileSync } from 'fs';
import { MirrorParams } from './bin/commands/mirror';
import { htmlToMd } from './utils';

export class MirrorUtils {
  private fetchedUrls: string[] = [];

  private readonly outDir: string;
  private readonly urls: string[];
  private readonly recursive: boolean;
  private readonly generateMd: boolean;
  private readonly selectors: string[];

  constructor(params: MirrorParams) {
    this.outDir = params.outDir;
    this.urls = params.urls;
    this.recursive = params.recursive;
    this.selectors = params.selectors;
    this.generateMd = params.generateMd;
  }

  async renderPage(browser: Browser, outDir: string, url: string) {
    const page = await browser.newPage();
    const responses: Response[] = [];
    page.on('response', (resp) => {
      responses.push(resp);
    });
    page.on('load', () => {
      responses.forEach(async (resp) => {
        const request = resp.request();
        const url = request.url();
        this.fetchedUrls.push(url);
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
      });
    });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 3000 });
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
      await this.renderPageGroup(browser, outDir, difference(links.filter(link => this.inSubFolder(link)), this.fetchedUrls));
    }

    await page.close();
    console.log(`rendered ${url}.`);
  }

  inSubFolder(link: string): boolean {
    return !!this.urls.find(url => link.startsWith(url));
  }

  async renderPageGroup(browser: Browser, outDir: string, urls: string[]) {
    await Promise.all(urls.map(url => this.renderPage(browser, outDir, url)));
  }

  async mirror() {
    const browser = await launch({ defaultViewport: { width: 1280, height: 768 } });
    const groups = chunk(uniq(this.urls), 4);
    for (let i = 0; i < groups.length; ++i) {
      await this.renderPageGroup(browser, this.outDir, groups[i]);
    }
    await browser.close();
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
