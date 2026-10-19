import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

test('home searches all sections and each other page searches only itself', async () => {
  const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const source = await fs.readFile(path.join(project, 'public/app.js'), 'utf8');
  assert.match(source, /\nload\(\);\s*$/);
  const node = { addEventListener() {} };
  const context = vm.createContext({
    document: { querySelector: () => node, addEventListener() {} },
    window: { addEventListener() {} }, URLSearchParams,
    location: { protocol: 'file:', hash: '' }
  });
  vm.runInContext(source.replace(/\nload\(\);\s*$/, '') + '\nObject.assign(state, previewData);', context);
  const search = (page, term) => {
    context.location.hash = `#${page}`;
    return vm.runInContext(`searchResults(${JSON.stringify(term)})`, context);
  };

  assert.match(search('home', '网页'), /最近在学：把想法做成网页/);
  assert.match(search('study', '网页'), /最近在学：把想法做成网页/);
  assert.match(search('life', '网页'), /找到 0 条相关内容/);
  assert.match(search('talk', '网页'), /找到 0 条相关内容/);
  assert.match(search('about', '网页'), /找到 0 条相关内容/);

  assert.match(search('home', '动漫'), /找到 2 条相关内容/);
  assert.match(search('talk', '动漫'), /欢迎来到留言角/);
  assert.doesNotMatch(search('talk', '动漫'), /关于我/);
  assert.match(search('about', '动漫'), /关于我/);
  assert.doesNotMatch(search('about', '动漫'), /欢迎来到留言角/);
});
