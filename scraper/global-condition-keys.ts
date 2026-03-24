import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data');
const CONDITION_KEYS_URL = 'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html';
const CONDITION_KEYS_DIR = join(DATA_DIR, 'condition-keys');

type GlobalConditionKey = {
  name: string;
  valueType: 'single' | 'multi';
  availability: string;
  description: string;
};

function normalizeKeyName(name: string): string {
  return name.replace(/\/tag-key$/, `/\${TagKey}`);
}

export async function run() {
  if (!existsSync(CONDITION_KEYS_DIR)) mkdirSync(CONDITION_KEYS_DIR, { recursive: true });

  const html = await fetch(CONDITION_KEYS_URL).then((r) => r.text());
  const $ = cheerio.load(html);

  const conditionKeys: GlobalConditionKey[] = [];

  $('#main-col-body h3').each((_i, heading) => {
    const name = $(heading).text().trim();
    if (!name.includes(':')) return;

    const descParts: string[] = [];
    let valueType: 'single' | 'multi' = 'single';
    let availability = '';

    let el = $(heading).next();
    while (el.length > 0 && !el.is('h2, h3')) {
      if (el.is('div.itemizedlist') || el.is('ul')) {
        const list = el.is('ul') ? el : el.find('> ul');
        list.find('> li').each((_j, li) => {
          const text = $(li).text();
          if (text.includes('Value type')) {
            valueType = text.toLowerCase().includes('multivalued') ? 'multi' : 'single';
          }
          if (text.includes('Availability')) {
            availability = text
              .replace(/^\s*Availability\s*–\s*/, '')
              .replace(/\s+/g, ' ')
              .trim();
          }
        });
        break;
      }

      if (el.is('p')) {
        const text = el.text().trim();
        if (text) descParts.push(text);
      }

      el = el.next();
    }

    const description = descParts.map((p) => p.replace(/\s+/g, ' ')).join('\n\n');
    if (!description) return;

    conditionKeys.push({ name: normalizeKeyName(name), valueType, availability, description });
  });

  conditionKeys.sort((a, b) => a.name.localeCompare(b.name));

  writeFileSync(join(CONDITION_KEYS_DIR, 'global.json'), JSON.stringify(conditionKeys, null, 2));
  console.log(`Wrote ${conditionKeys.length} global condition keys`);
}
