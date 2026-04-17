import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Audit-coverage guardrail.
 *
 * Scans every `*.action.ts` under `src/modules/**` and requires each exported
 * async function that performs a Prisma mutation (create/update/delete/upsert
 * on the `db.<model>` client) to also reference `audit(` — our audit helper.
 *
 * A function can opt out by annotating its leading JSDoc with `@no-audit`.
 * Read-only actions don't match the mutation pattern, so they're ignored
 * automatically.
 *
 * This runs without external parser dependencies by using scoped regex over
 * each function's body. It's imperfect on deeply nested helpers but catches
 * the common missed-audit case at PR time.
 */

const MODULES_ROOT = join(__dirname, "..", "..", "..", "src", "modules");

function listActionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listActionFiles(p));
    else if (entry.endsWith(".action.ts")) out.push(p);
  }
  return out;
}

interface FunctionBlock {
  name: string;
  body: string;
  hasNoAuditTag: boolean;
}

// Matches top-level exported async functions and captures name + balanced body.
function extractExportedFunctions(src: string): FunctionBlock[] {
  const blocks: FunctionBlock[] = [];
  const sigRe = /export\s+async\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = sigRe.exec(src)) !== null) {
    const name = m[1];
    // Find the opening brace of the function body
    let i = src.indexOf("{", sigRe.lastIndex);
    if (i === -1) continue;
    let depth = 0;
    let end = -1;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) continue;
    const body = src.slice(i, end + 1);

    // Look back for @no-audit JSDoc tag
    const preStart = Math.max(0, m.index - 400);
    const preamble = src.slice(preStart, m.index);
    const hasNoAuditTag = /@no-audit\b/.test(preamble);

    blocks.push({ name, body, hasNoAuditTag });
  }
  return blocks;
}

const MUTATION_RE =
  /\b(?:db|tx|prisma)\s*\.\s*[A-Za-z_$][\w$]*\s*\.\s*(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/;

const AUDIT_RE = /\baudit\s*\(/;

// Workflow engine calls write their own audit entries as a side effect.
const WORKFLOW_CALL_RE = /\b(?:transitionWorkflow|transitionWorkflowWithAutoStart)\s*\(/;

describe("audit-coverage guardrail", () => {
  const files = listActionFiles(MODULES_ROOT);

  it("discovers at least 50 action files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("every mutating exported action calls audit() (or opts out with @no-audit)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const blocks = extractExportedFunctions(src);
      for (const b of blocks) {
        if (b.hasNoAuditTag) continue;
        const mutates = MUTATION_RE.test(b.body);
        if (!mutates) continue;
        const audited = AUDIT_RE.test(b.body) || WORKFLOW_CALL_RE.test(b.body);
        if (!audited) {
          offenders.push(`${relative(process.cwd(), file)}::${b.name}`);
        }
      }
    }

    if (offenders.length > 0) {
      const msg =
        `Missing audit() in ${offenders.length} mutating action(s):\n` +
        offenders.map((o) => `  - ${o}`).join("\n") +
        `\n\nAdd 'await audit({ ... })' to the function, or annotate its JSDoc with @no-audit if intentional.`;
      throw new Error(msg);
    }
  });
});
