"use client";

// Import / export tab: move milestones, budget lines, risks and team members
// between this tracker and other tools as CSV. Imports are always checked
// first, with a row-by-row report, before anything is written.
import { useState } from "react";
import { importCsvAction } from "@/lib/pm/actions";
import { parseCsv } from "@/lib/pm/csv";
import type { ImportOutcome } from "@/lib/pm/import";
import { ENTITIES, ENTITY_KEYS, autoMap, type ColumnMapping, type EntityKey } from "@/lib/pm/interchange";
import type { Project } from "@/lib/pm/types";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";
import { btnPrimary, btnSecondary, fieldClass, labelClass, selectClass } from "./styles";

export default function DataExchange({ project }: { project: Project }) {
  const { showError } = usePm();
  const [entity, setEntity] = useState<EntityKey>("milestones");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [check, setCheck] = useState<ImportOutcome | null>(null);
  const [done, setDone] = useState<ImportOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = csv.trim() ? (parseCsv(csv)[0] ?? []).map((h) => h.trim()) : [];
  const def = ENTITIES[entity];

  function load(text: string, name: string, kind: EntityKey = entity) {
    setCsv(text);
    setFileName(name);
    setCheck(null);
    setDone(null);
    setMapping(text.trim() ? autoMap(kind, (parseCsv(text)[0] ?? []).map((h) => h.trim())) : {});
  }

  async function run(dryRun: boolean) {
    setBusy(true);
    const result = await runAction(() => importCsvAction({ projectId: project.id, entity, csv, mapping, dryRun }));
    setBusy(false);
    if (!result.ok) return showError(result.error);
    if (dryRun) {
      setCheck(result.data);
      setDone(null);
    } else {
      setDone(result.data);
      setCheck(null);
      setCsv("");
      setFileName("");
    }
  }

  const ready = check && check.created + check.updated > 0;

  return (
    <div className="space-y-8">
      <section aria-labelledby="pm-import-heading" className="rounded-lg border border-line bg-white p-4">
        <h2 id="pm-import-heading" className="font-display text-base text-ink">
          Import from another tool
        </h2>
        <p className="mt-1 text-sm text-graphite">
          Export a CSV from the other system (Azure DevOps, MS Project, Primavera, Excel) and load it here. Rows are matched to what is already in the
          project and updated; anything new is added. An import never deletes.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass} htmlFor="pm-import-entity">
              What the file contains
            </label>
            <select
              id="pm-import-entity"
              className={`${selectClass} py-2`}
              value={entity}
              onChange={(e) => {
                const next = e.target.value as EntityKey;
                setEntity(next);
                load(csv, fileName, next);
              }}
            >
              {ENTITY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {ENTITIES[k].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-import-file">
              CSV file
            </label>
            <input
              id="pm-import-file"
              type="file"
              accept=".csv,.txt,.tsv,text/csv"
              className="block text-sm text-graphite file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-ink"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2_000_000) return showError("That file is too large (2 MB limit).");
                load(await file.text(), file.name);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <label className={`${labelClass} mt-4`} htmlFor="pm-import-text">
          Or paste rows, with the header row first {fileName && <span className="normal-case text-ink">· loaded {fileName}</span>}
        </label>
        <textarea
          id="pm-import-text"
          className={`${fieldClass} font-mono text-xs sm:text-xs`}
          rows={5}
          value={csv}
          placeholder={def.fields.map((f) => f.label).join(",")}
          onChange={(e) => load(e.target.value, "")}
        />
        <p className="mt-1 text-xs text-graphite">
          Matched by {def.matchedBy}. Dates like 3/4/2027 are read month first (March 4). Amounts can be 1250000, $1,250,000 or 1.25M.
        </p>

        {headers.length > 0 && (
          <div className="mt-4">
            <h3 className={labelClass}>Columns</h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {def.fields.map((f) => (
                <li key={f.key}>
                  <label className="block text-xs text-graphite" htmlFor={`pm-map-${f.key}`}>
                    {f.label}
                    {f.required && <span className="text-warn"> (required)</span>}
                    {f.hint && <span> · {f.hint}</span>}
                  </label>
                  <select
                    id={`pm-map-${f.key}`}
                    className={`${selectClass} mt-0.5 w-full`}
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => {
                      setMapping({ ...mapping, [f.key]: e.target.value === "" ? null : Number(e.target.value) });
                      setCheck(null);
                    }}
                  >
                    <option value="">Not in this file</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className={btnSecondary} onClick={() => run(true)} disabled={busy || !csv.trim()}>
            {busy && !ready ? "Checking…" : "Check file"}
          </button>
          <button type="button" className={btnPrimary} onClick={() => run(false)} disabled={busy || !ready}>
            {ready ? `Import ${check.created + check.updated} ${check.created + check.updated === 1 ? "row" : "rows"}` : "Import"}
          </button>
          {!check && csv.trim() && <span className="text-xs text-graphite">Check the file first to see what will change.</span>}
        </div>

        {(check || done) && <Outcome outcome={(check || done)!} />}
      </section>

      <section aria-labelledby="pm-export-heading" className="rounded-lg border border-line bg-white p-4">
        <h2 id="pm-export-heading" className="font-display text-base text-ink">
          Export
        </h2>
        <p className="mt-1 text-sm text-graphite">Download this project&apos;s records as CSV. The columns are the same ones the import reads, so a file can go out, be edited, and come back.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ENTITY_KEYS.map((k) => (
            <li key={k}>
              <a className={btnSecondary} href={`/pm/api/export?project=${encodeURIComponent(project.slug)}&type=${k}`} download>
                {ENTITIES[k].label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Outcome({ outcome }: { outcome: ImportOutcome }) {
  const verb = outcome.dryRun ? "will be" : "were";
  const total = outcome.created + outcome.updated;
  return (
    <div role="status" className={`mt-4 rounded-md border p-3 text-sm ${outcome.dryRun ? "border-line bg-paper" : "border-accent/40 bg-accent/10"}`}>
      <p className="text-ink">
        <strong className="font-medium">{outcome.dryRun ? "Check complete, nothing written yet." : "Import complete."}</strong> {outcome.rowCount}{" "}
        {outcome.rowCount === 1 ? "row" : "rows"} in the file: {outcome.created} {verb} added, {outcome.updated} {verb} updated
        {outcome.issues.length > 0 ? `, ${outcome.issues.length} left out` : ""}.
        {outcome.workstreamsCreated.length > 0 && ` New workstreams ${verb} created: ${outcome.workstreamsCreated.join(", ")}.`}
        {total === 0 && outcome.issues.length === 0 && " There were no data rows."}
      </p>
      {outcome.issues.length > 0 && (
        <>
          <p className="mt-2 font-medium text-warn">Left out</p>
          <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs text-ink">
            {outcome.issues.slice(0, 100).map((issue, i) => (
              <li key={i}>
                Line {issue.line}: {issue.message}
              </li>
            ))}
            {outcome.issues.length > 100 && <li>…and {outcome.issues.length - 100} more.</li>}
          </ul>
        </>
      )}
      {outcome.warnings.length > 0 && (
        <>
          <p className="mt-2 font-medium text-amber-800">Imported with a caveat</p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-ink">
            {outcome.warnings.slice(0, 50).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
