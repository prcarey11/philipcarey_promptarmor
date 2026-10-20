import { submitAd } from "@/app/actions";
import { SubmitButton } from "./submit-button";

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

export default function NewSubmissionPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">New Submission</h1>
      <form action={submitAd} className="space-y-4">
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
            <select
              id="channel"
              name="channel"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <select
              id="product"
              name="product"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
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

        <SubmitButton />
      </form>
    </div>
  );
}
