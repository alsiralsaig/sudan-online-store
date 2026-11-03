import { parseMarkdownSellTable } from './src/server/rates';
const raw = await (await fetch('https://r.jina.ai/https://www.sudanakhbar.com/1867968', { headers: { Accept: 'text/plain', 'X-Return-Format': 'text' } })).text();
const m = parseMarkdownSellTable(raw);
console.log('FINAL USD:', m.get('USD'));
