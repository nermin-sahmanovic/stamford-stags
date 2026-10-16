"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { CheckIcon, UploadIcon } from "@/components/shell/icons";
import { Pill, StatCard } from "@/components/ui";
import { autoMapColumns, IMPORT_FIELDS, type ImportFieldKey } from "@/lib/roster/fields";
import {
  MAX_IMPORT_ROWS,
  validateImportRows,
  type ImportIssue,
  type ImportResult,
  type RawImportRow,
} from "@/lib/roster/schema";
import { importPlayers } from "../actions";

const MAX_FILE_BYTES = 1024 * 1024;

type Parsed = { fileName: string; headers: string[]; rows: Record<string, string>[] };
type Existing = { email: string; active: boolean };

export function ImportWizard({ existing, maxRoster }: { existing: Existing[]; maxRoster: number | null }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<ImportFieldKey, string> | null>(null);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setParsed(null);
    setMapping(null);
    setResult(null);
    setFileError(null);
    setStep("upload");
  }

  function onFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError("That file is over 1 MB. Split it into smaller files.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: ({ data, meta, errors }) => {
        const headers = (meta.fields ?? []).filter(Boolean);
        if (headers.length === 0 || data.length === 0) {
          setFileError("Couldn't find a header row and data in that file. Is it a CSV?");
          return;
        }
        if (data.length > MAX_IMPORT_ROWS) {
          setFileError(`That file has ${data.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time.`);
          return;
        }
        if (errors.some((e) => e.type === "Quotes")) {
          setFileError("The file has a broken quoted cell. Re-save it from your spreadsheet as CSV and try again.");
          return;
        }
        setParsed({ fileName: file.name, headers, rows: data });
        setMapping(autoMapColumns(headers));
        setStep("map");
      },
      error: () => setFileError("Couldn't read that file."),
    });
  }

  if (step === "upload" || !parsed || !mapping) {
    return (
      <StepCard number={1} title="Upload a CSV">
        <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-court focus-within:border-court">
          <UploadIcon size={28} className="text-court" />
          <span className="text-[16px] font-bold">Choose a .csv file</span>
          <span className="text-[13px] text-slate-600">Up to {MAX_IMPORT_ROWS} rows. First row must be headers.</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {fileError ? (
          <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
            {fileError}
          </p>
        ) : null}
        <p className="text-[13px] text-slate-600">
          Tip: <a href="/api/roster/export">export the roster</a> to get a file in the right shape.
        </p>
      </StepCard>
    );
  }

  const rawRows: RawImportRow[] = parsed.rows.map((row, i) => ({
    // Row 1 is the header, so data starts on spreadsheet row 2.
    rowNumber: i + 2,
    values: Object.fromEntries(
      IMPORT_FIELDS.map((f) => [f.key, mapping[f.key] ? String(row[mapping[f.key]] ?? "") : ""]),
    ),
  }));

  if (step === "map") {
    const used = Object.values(mapping).filter(Boolean);
    const duplicate = used.find((h, i) => used.indexOf(h) !== i);
    const missing = IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]);
    const ignored = parsed.headers.filter((h) => !used.includes(h));

    return (
      <StepCard number={2} title="Match the columns">
        <p className="text-[14px] text-slate-600">
          <span className="font-semibold text-navy">{parsed.fileName}</span> · {parsed.rows.length} rows
        </p>
        <div className="flex flex-col gap-2.5">
          {IMPORT_FIELDS.map((field) => (
            <label key={field.key} className="grid grid-cols-[110px_1fr] items-center gap-2 text-[14px] font-semibold">
              <span>
                {field.label}
                {field.required ? <span className="text-warn"> *</span> : null}
              </span>
              <select
                value={mapping[field.key]}
                onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                className="h-11 w-full min-w-0 rounded-[10px] border border-slate-300 bg-white px-3 text-base"
              >
                <option value="">— Don&apos;t import —</option>
                {parsed.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {ignored.length > 0 ? (
          <p className="text-[13px] text-slate-600">
            Not imported: {ignored.join(", ")}
            {ignored.some((h) => h.trim().toLowerCase() === "role") ? " (roles only change in the edit form)" : ""}.
          </p>
        ) : null}
        {missing.length > 0 || duplicate ? (
          <p role="alert" className="text-[14px] font-semibold text-warn">
            {missing.length > 0
              ? `Choose a column for ${missing.map((f) => f.label).join(" and ")}.`
              : `"${duplicate}" is used for two fields.`}
          </p>
        ) : null}
        <div className="flex gap-2.5">
          <SecondaryButton onClick={reset}>Start over</SecondaryButton>
          <PrimaryButton disabled={missing.length > 0 || Boolean(duplicate)} onClick={() => setStep("preview")}>
            Preview
          </PrimaryButton>
        </div>
      </StepCard>
    );
  }

  if (step === "done" && result) {
    return <Summary result={result} onAgain={reset} />;
  }

  return (
    <Preview
      rows={rawRows}
      existing={existing}
      maxRoster={maxRoster}
      pending={pending}
      error={result && !result.ok ? result.message : null}
      onBack={() => setStep("map")}
      onImport={() =>
        startTransition(async () => {
          const outcome = await importPlayers(rawRows);
          setResult(outcome);
          if (outcome.ok) setStep("done");
        })
      }
    />
  );
}

function Preview({
  rows,
  existing,
  maxRoster,
  pending,
  error,
  onBack,
  onImport,
}: {
  rows: RawImportRow[];
  existing: Existing[];
  maxRoster: number | null;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onImport: () => void;
}) {
  const { valid, invalid } = useMemo(() => validateImportRows(rows), [rows]);
  const known = useMemo(() => new Map(existing.map((p) => [p.email, p.active])), [existing]);

  const newCount = valid.filter((r) => !known.has(r.data.email)).length;
  const updateCount = valid.length - newCount;

  // Active roster size if this import goes through.
  const active = new Map(known);
  for (const { data } of valid) active.set(data.email, data.is_active ?? known.get(data.email) ?? true);
  const projectedActive = [...active.values()].filter(Boolean).length;
  const over = maxRoster !== null && projectedActive > maxRoster;

  return (
    <StepCard number={3} title="Check and import">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="New" value={newCount} />
        <MiniStat label="Update" value={updateCount} />
        <MiniStat label="Errors" value={invalid.length} warn={invalid.length > 0} />
      </div>

      {over ? (
        <p role="status" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
          After this import the active roster will be {projectedActive}, over the season max of {maxRoster}.
          You can still import and deactivate players afterwards.
        </p>
      ) : null}

      {invalid.length > 0 ? (
        <section aria-labelledby="skip-heading" className="flex flex-col gap-2">
          <h3 id="skip-heading" className="text-[15px] font-bold text-warn">
            {invalid.length} {invalid.length === 1 ? "row" : "rows"} will be skipped
          </h3>
          <IssueList issues={invalid} />
        </section>
      ) : null}

      <section aria-labelledby="ok-heading" className="flex flex-col gap-2">
        <h3 id="ok-heading" className="text-[15px] font-bold">
          {valid.length} ready to import
        </h3>
        <ul className="max-h-[360px] overflow-y-auto rounded-[12px] border border-line">
          {valid.map(({ rowNumber, data }) => (
            <li key={rowNumber} className="flex items-center gap-2.5 border-b border-[#EEF2F6] px-3 py-2.5 last:border-b-0">
              <span className="w-12 shrink-0 text-[12px] font-semibold text-slate-500">Row {rowNumber}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold">{data.full_name}</span>
                <span className="block truncate text-[13px] text-slate-600">
                  {data.email}
                  {data.ntrp_rating !== null ? ` · ${data.ntrp_rating.toFixed(1)}` : ""}
                </span>
              </span>
              {known.has(data.email) ? <Pill tone="blue">Update</Pill> : <Pill tone="ball">New</Pill>}
            </li>
          ))}
        </ul>
      </section>

      {error ? (
        <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2.5">
        <SecondaryButton onClick={onBack} disabled={pending}>
          Back
        </SecondaryButton>
        <PrimaryButton onClick={onImport} disabled={pending || valid.length === 0}>
          {pending ? "Importing…" : `Import ${valid.length} ${valid.length === 1 ? "row" : "rows"}`}
        </PrimaryButton>
      </div>
    </StepCard>
  );
}

function Summary({ result, onAgain }: { result: ImportResult; onAgain: () => void }) {
  if (!result.ok) return null;
  return (
    <section aria-labelledby="summary-heading" role="status" className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 rounded-2xl bg-navy px-4 py-4 text-white">
        <span className="flex size-10 items-center justify-center rounded-full bg-ball text-navy">
          <CheckIcon size={20} />
        </span>
        <h2 id="summary-heading" className="font-display text-[26px] font-bold uppercase">
          Import finished
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatCard label="Created" value={result.created} note="new players" />
        <StatCard label="Updated" value={result.updated} note="changed" />
        <StatCard label="Unchanged" value={result.unchanged} note="already up to date" />
        <StatCard
          label="Skipped"
          value={result.skipped.length}
          note={result.skipped.length ? "see below" : "no errors"}
          noteClassName={result.skipped.length ? "text-warn font-semibold" : "text-slate-600"}
        />
      </div>
      {result.skipped.length > 0 ? (
        <section aria-labelledby="skipped-heading" className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
          <h3 id="skipped-heading" className="text-[15px] font-bold text-warn">
            Skipped rows — fix these in the file and import it again
          </h3>
          <IssueList issues={result.skipped} />
        </section>
      ) : null}
      <div className="flex gap-2.5">
        <SecondaryButton onClick={onAgain}>Import another file</SecondaryButton>
        <Link
          href="/captain/roster"
          className="flex h-12 flex-[2] items-center justify-center rounded-[12px] bg-navy text-[16px] font-bold text-white no-underline hover:bg-navy-2 hover:text-white"
        >
          View roster
        </Link>
      </div>
    </section>
  );
}

function IssueList({ issues }: { issues: ImportIssue[] }) {
  return (
    <ul className="overflow-hidden rounded-[12px] border border-warn/30 bg-warn-bg/40">
      {issues.map((issue) => (
        <li key={issue.rowNumber} className="border-b border-warn/20 px-3 py-2.5 last:border-b-0">
          <div className="text-[14px] font-bold">
            Row {issue.rowNumber}
            <span className="font-normal text-slate-700"> · {issue.email || "no email"}</span>
          </div>
          <ul className="text-[13px] font-semibold text-warn">
            {issue.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="flex items-center gap-2.5 font-display text-[22px] font-bold tracking-[0.03em] uppercase">
        <span className="flex size-7 items-center justify-center rounded-full bg-navy font-sans text-[14px] text-ball">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-[12px] border p-2.5 ${warn ? "border-warn/40 bg-warn-bg" : "border-line"}`}>
      <div className="text-[12px] font-semibold tracking-[0.06em] text-slate-500 uppercase">{label}</div>
      <div className={`font-display text-[28px] leading-none font-bold ${warn ? "text-warn" : ""}`}>{value}</div>
    </div>
  );
}

function PrimaryButton(props: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="h-12 flex-[2] rounded-[12px] bg-navy text-[16px] font-bold text-white hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}

function SecondaryButton(props: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="h-12 flex-1 rounded-[12px] border-[1.5px] border-slate-300 text-[16px] font-semibold text-navy hover:bg-slate-50 disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}
