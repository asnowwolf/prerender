import * as remarkStringify from 'remark-stringify';
import * as rehypeParse from 'rehype-parse';
import * as rehypeRemark from 'rehype-remark';
import * as unified from 'unified';
import * as stringWidth from 'string-width';

const stringifyOptions = {
  emphasis: '*', listItemIndent: 1, incrementListMarker: false, stringLength: stringWidth,
};

export function htmlToMd(html: string): string {
  return unified().use(rehypeParse).use(rehypeRemark).use(remarkStringify, stringifyOptions).processSync(html).contents.toString();
}
