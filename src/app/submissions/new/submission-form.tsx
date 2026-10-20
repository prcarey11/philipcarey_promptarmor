"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useFormStatus } from "react-dom";
import { submitAd, previewCheck, type PreviewCheckResult } from "@/app/actions";
import { SOURCE_LABELS } from "@/lib/labels";
import type { FlagInput } from "@/lib/rules/types";

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "landing_page", label: "Landing Page" },
  { value: "social", label: "Social Media" },
  { value: "sms", label: "SMS" },
];

const PRODUCTS = [
  { value: "Personal Loan", label: "Personal Loan" },
  { value: "Credit Card", label: "Credit Card" },
  { value: "Mortgage", label: "Mortgage Prequalification" },
];

const COOLDOWN_SECONDS = 10;

function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    rule: "bg-purple-100 text-purple-700",
    llm: "bg-indigo-100 text-indigo-700",
    human: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${styles[source] ?? "bg-gray-100"}`}>
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

function PreviewFlag({ flag }: { flag: FlagInput }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <SourceBadge source={flag.source} />
        <span className="text-xs text-gray-500">{flag.location}</span>
      </div>
      <p className="text-sm font-medium">{flag.problem}</p>
      <p className="text-xs text-gray-500">{flag.rule}</p>
      <p className="text-sm text-gray-700">
        <span className="font-medium">Fix:</span> {flag.fix}
      </p>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Submitting — running compliance checks..." : "Submit for Review"}
    </button>
  );
}

export function SubmissionForm() {
  const [preview, setPreview] = useState<PreviewCheckResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  async function handlePreview() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const content = formData.get("content") as string;
    if (!content.trim()) return;

    setPreviewLoading(true);
    try {
      const result = await previewCheck(formData);
      setPreview(result);
      startCooldown();
    } finally {
      setPreviewLoading(false);
    }
  }

  const allFlags = preview
    ? [...preview.ruleFlags, ...preview.llmFlags]
    : [];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">New Submission</h1>

      <form ref={formRef} action={(formData) => { setPreview(null); return submitAd(formData); }} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            placeholder="e.g., Q4 Personal Loan Email Campaign"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="channel" className="block text-sm font-medium text-gray-700 mb-1">
              Channel
            </label>
            <select id="channel" name="channel" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <select id="product" name="product" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              {PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            Ad Content
          </label>
          <textarea
            id="content"
            name="content"
            required
            rows={10}
            placeholder="Paste the full ad copy here..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
          />
        </div>

        <div className="flex gap-3 items-center">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || cooldown > 0}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {previewLoading
              ? "Running pre-check..."
              : cooldown > 0
                ? `Re-check available in ${cooldown}s`
                : "Run Pre-Check"}
          </button>
          <SubmitButton />
        </div>
      </form>

      {/* Preview results */}
      {preview && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Preview — not submitted
            </h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {allFlags.length} issue{allFlags.length !== 1 ? "s" : ""} found
            </span>
            {preview.llmStatus === "failed" && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                AI pre-check unavailable — rule checks only
              </span>
            )}
          </div>
          {allFlags.length === 0 ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              No issues found. You can submit for review.
            </p>
          ) : (
            <div className="space-y-2">
              {allFlags.map((flag, i) => (
                <PreviewFlag key={i} flag={flag} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
