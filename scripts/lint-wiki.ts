import { errorsOf, formatIssue, loadWiki } from '../src/lib/content/corpus';

const load = loadWiki(process.cwd(), { dashboards: true });
for (const i of load.issues) console.log(formatIssue(i));
const errors = errorsOf(load).length;
const warnings = load.issues.length - errors;
console.log(`lint-wiki: ${load.pages.length} pages, ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);
