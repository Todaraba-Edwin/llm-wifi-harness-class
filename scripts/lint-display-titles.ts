// Every content page needs exactly one bilingual display-title source (frontmatter pair or curated map entry).
import { loadWiki } from '../src/lib/content/corpus';
import { resolveDisplayTitles } from '../src/lib/content/display-titles';

const load = loadWiki(process.cwd());
const { errors } = resolveDisplayTitles(load.pages);
for (const e of errors) console.error(`ERROR ${e}`);
console.log(`lint-display-titles: ${load.pages.length} pages, ${errors.length} error(s)`);
process.exit(errors.length ? 1 : 0);
