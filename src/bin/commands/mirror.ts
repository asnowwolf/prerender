import { CommandBuilder } from 'yargs';
import { MirrorUtils } from '../../mirror';

export const command = `mirror <outDir> <urls...>`;

export const describe = '抓取 siteUrl，镜像到本地';

export const builder: CommandBuilder = {
  outDir: {
    type: 'string',
    description: '要存到的目录',
  },
  urls: {
    type: 'array',
    description: '要下载的 url，可指定任意多个',
    default: [''],
  },
  selectors: {
    type: 'array',
    description: '内容的选择器，可以同时指定多个',
  },
  recursive: {
    type: 'boolean',
    default: false,
    alias: 'r',
  },
  generateMd: {
    boolean: true,
    default: false,
    description: '是否同时为 html 中 selectors 指定的内容生成 markdown 版本',
    alias: 'md',
  },
};

export interface MirrorParams {
  outDir: string;
  urls: string[];
  selectors: string[];
  recursive: boolean;
  generateMd: boolean;
}

export const handler = function (params: MirrorParams) {
  new MirrorUtils(params).mirror().then(() => {
    console.log('Done!');
  });
};
