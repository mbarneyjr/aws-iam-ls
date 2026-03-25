import type { TreeBase } from './base.ts';
import { TreeHcl } from './hcl.ts';
import { TreeJson } from './json.ts';
import { TreeYaml } from './yaml.ts';

export type DocumentFormat = 'yaml' | 'json' | 'hcl';

const languages = {
  yaml: TreeYaml,
  json: TreeJson,
  hcl: TreeHcl,
} as const;

export class TreeManager {
  #trees: Record<DocumentFormat, TreeBase | null> = {
    yaml: null,
    json: null,
    hcl: null,
  };
  #uriToFormat = new Map<string, DocumentFormat>();

  async openDocument(uri: string, content: string, languageId: string) {
    const format = TreeManager.#detectFormat(uri, languageId);
    if (!format) return;
    this.#uriToFormat.set(uri, format);
    if (!this.#trees[format]) {
      this.#trees[format] = await languages[format].init();
    }
    this.#trees[format].openDocument(uri, content);
  }

  async updateDocument(uri: string, content: string) {
    const format = this.#uriToFormat.get(uri);
    if (!format) return;
    if (!this.#trees[format]) {
      this.#trees[format] = await languages[format].init();
    }
    this.#trees[format].updateDocument(uri, content);
  }

  closeDocument(uri: string) {
    const format = this.#uriToFormat.get(uri);
    if (!format) return;
    if (this.#trees[format]) {
      this.#trees[format].closeDocument(uri);
    }
    this.#uriToFormat.delete(uri);
  }

  getLanguageHandler(uri: string) {
    const format = this.#uriToFormat.get(uri);
    if (!format) return null;
    return this.#trees[format] || null;
  }

  static #detectFormat(uri: string, languageId: string): DocumentFormat | undefined {
    const id = languageId.toLowerCase();
    if (id.startsWith('yaml')) return 'yaml';
    if (id.startsWith('json')) return 'json';
    if (id === 'terraform' || id === 'hcl' || id === 'tofu' || id === 'opentofu') return 'hcl';

    if (uri.endsWith('.yaml') || uri.endsWith('.yml')) return 'yaml';
    if (uri.endsWith('.json')) return 'json';
    if (uri.endsWith('.tf') || uri.endsWith('.tofu')) return 'hcl';

    return undefined;
  }
}
