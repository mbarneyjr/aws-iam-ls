import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ServiceData } from '../src/lib/iam-policy/reference/types.ts';

const BASE_URL = 'https://docs.aws.amazon.com/service-authorization/latest/reference';
const INDEX_URL = `${BASE_URL}/reference_policies_actions-resources-contextkeys.html`;
const SERVICES_DIR = join(import.meta.dirname, '..', 'src', 'data', 'servicereference', 'services');
const CONCURRENCY = 10;

export async function run() {
  const indexHtml = await fetch(INDEX_URL).then((r) => r.text());
  const $ = cheerio.load(indexHtml);

  const slugs: string[] = [];
  $('a[href^="./list_"]').each((_i, el) => {
    const href = $(el).attr('href');
    if (href) slugs.push(href.replace('./', ''));
  });

  console.log(`Found ${slugs.length} service doc pages`);
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < slugs.length; i += CONCURRENCY) {
    const batch = slugs.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((slug) => scrapeAndMerge(slug)));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
      } else {
        failed++;
        console.warn(`  Failed: ${result.reason}`);
      }
    }
    process.stdout.write(`Processed ${processed} service doc pages (${failed} failed)\r`);
  }

  console.log(`\nProcessed ${processed} service doc pages (${failed} failed)`);
}

async function scrapeAndMerge(slug: string): Promise<void> {
  const html = await fetch(`${BASE_URL}/${slug}`).then((r) => r.text());
  const $ = cheerio.load(html);

  const prefixCode = $('#main-col-body p code').first();
  const prefix = prefixCode.text().trim();
  if (!prefix) {
    throw new Error(`No service prefix found in ${slug}`);
  }

  const servicePath = join(SERVICES_DIR, `${prefix}.json`);
  if (!existsSync(servicePath)) return;

  const serviceData: ServiceData = JSON.parse(readFileSync(servicePath, 'utf-8'));
  serviceData.url = `${BASE_URL}/${slug}`;

  const actionDocs = parseActionsTable($);
  for (const [name, docs] of Object.entries(actionDocs)) {
    const action = serviceData.actions[name];
    if (action) {
      action.description = docs.description;
      action.accessLevel = docs.accessLevel;
      action.resourceTypes = docs.resourceTypes;
      action.dependentActions = docs.dependentActions.length > 0 ? docs.dependentActions : undefined;
      action.permissionOnly = docs.permissionOnly || undefined;
      action.url = docs.url || undefined;
    }
  }

  const conditionKeyDocs = parseConditionKeysTable($);
  for (const [name, docs] of Object.entries(conditionKeyDocs)) {
    const key = serviceData.conditionKeys[name];
    if (key) {
      key.description = docs.description;
    }
  }

  writeFileSync(servicePath, JSON.stringify(serviceData));
}

type ScrapedAction = {
  description: string;
  accessLevel: string;
  resourceTypes: Array<{ name: string; required: boolean }>;
  dependentActions: string[];
  permissionOnly: boolean;
  url: string;
};

function parseActionsTable($: cheerio.CheerioAPI): Record<string, ScrapedAction> {
  const actions: Record<string, ScrapedAction> = {};

  const table = findTableByHeader($, 'Actions');
  if (!table) return actions;

  const carryOver: Array<{ col: number; value: cheerio.Cheerio<Element>; remaining: number }> = [];

  table.find('tbody tr').each((_i, row) => {
    const rawCells = $(row).find('td');
    const cells: cheerio.Cheerio<Element>[] = [];

    let rawIdx = 0;
    for (let col = 0; col < 6; col++) {
      const carried = carryOver.find((c) => c.col === col);
      if (carried) {
        cells.push(carried.value);
        carried.remaining--;
        if (carried.remaining <= 0) {
          carryOver.splice(carryOver.indexOf(carried), 1);
        }
      } else if (rawIdx < rawCells.length) {
        const cell = $(rawCells[rawIdx]);
        const rowspan = Number.parseInt(cell.attr('rowspan') || '1', 10);
        if (rowspan > 1) {
          carryOver.push({ col, value: cell, remaining: rowspan - 1 });
        }
        cells.push(cell);
        rawIdx++;
      }
    }

    if (cells.length < 6) return;

    const actionCell = cells[0];
    const actionLink = actionCell.find('a').first();
    let actionName = actionLink.length > 0 ? actionLink.text().trim() : actionCell.text().trim();
    if (!actionName) return;

    const url = actionLink.attr('href') ?? '';

    const permissionOnly = actionCell.text().includes('[permission only]');
    actionName = actionName.replace(/\s*\[permission only\]\s*/, '').trim();

    const description = cells[1].text().trim();
    const accessLevel = cells[2].text().trim();

    const resourceTypes: Array<{ name: string; required: boolean }> = [];
    const rtParagraphs = cells[3].find('p');
    const rtTexts: string[] = [];
    if (rtParagraphs.length > 0) {
      rtParagraphs.each((_j, p) => {
        const text = cheerio.load(p).text().trim();
        if (text) rtTexts.push(text);
      });
    } else {
      const text = cells[3].text().trim();
      if (text) rtTexts.push(text);
    }
    for (const text of rtTexts) {
      const required = text.endsWith('*');
      const name = text.replace(/\*$/, '').trim();
      if (name) resourceTypes.push({ name, required });
    }

    const dependentActions = extractTextList(cells[5]);

    if (actions[actionName]) {
      for (const rt of resourceTypes) {
        if (!actions[actionName].resourceTypes.some((e) => e.name === rt.name)) {
          actions[actionName].resourceTypes.push(rt);
        }
      }
      for (const da of dependentActions) {
        if (!actions[actionName].dependentActions.includes(da)) {
          actions[actionName].dependentActions.push(da);
        }
      }
      return;
    }

    actions[actionName] = {
      description,
      accessLevel,
      resourceTypes,
      dependentActions,
      permissionOnly,
      url,
    };
  });

  return actions;
}

function parseConditionKeysTable($: cheerio.CheerioAPI): Record<string, { description: string }> {
  const conditionKeys: Record<string, { description: string }> = {};

  const table = findTableByHeader($, 'Condition keys');
  if (!table) return conditionKeys;

  table.find('tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const nameCell = $(cells[0]);
    const name = nameCell.text().trim();
    if (!name) return;

    const description = $(cells[1]).text().trim();
    conditionKeys[name] = { description };
  });

  return conditionKeys;
}

function findTableByHeader($: cheerio.CheerioAPI, headerText: string): cheerio.Cheerio<Element> | null {
  let found: cheerio.Cheerio<Element> | null = null;
  $('table').each((_i, table) => {
    if (found) return;
    const firstTh = $(table).find('thead th').first().text().trim();
    if (firstTh === headerText) {
      found = $(table);
    }
  });
  return found;
}

function extractTextList(cell: cheerio.Cheerio<Element>): string[] {
  const results: string[] = [];
  const paragraphs = cell.find('p');
  if (paragraphs.length > 0) {
    paragraphs.each((_i, p) => {
      const text = cheerio.load(p).text().trim();
      if (text) results.push(text);
    });
  } else {
    const html = cell.html() || '';
    const parts = html.split(/<br\s*\/?>/i);
    for (const part of parts) {
      const text = cheerio.load(part).text().trim();
      if (text) results.push(text);
    }
  }
  return results;
}
