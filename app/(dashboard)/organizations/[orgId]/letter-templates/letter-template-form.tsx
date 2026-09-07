"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  LETTER_TEMPLATE_TYPES,
  LETTER_TEMPLATE_TYPE_LABELS,
  getPlaceholders,
} from "@/lib/letters/placeholders";
import { renderTemplate } from "@/lib/letters/render-template";
import {
  SAMPLE_SEASON_TOKEN_VALUES,
  SAMPLE_SPONSOR_TOKEN_VALUES,
} from "@/lib/letters/sample-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createLetterTemplate, updateLetterTemplate } from "./actions";

import type { LetterTemplateType } from "@/lib/letters/placeholders";

interface LetterTemplateDefaults {
  id: string;
  name: string;
  template_type: LetterTemplateType;
  heading: string | null;
  body: string;
  closing: string | null;
  is_default: boolean;
}

const DEFAULT_CLOSING = "Sincerely,";

const STARTER_BODY_BY_TYPE: Record<LetterTemplateType, string> = {
  season_balance: `Dear {{guardian_name}},

Our records show an outstanding balance of {{balance_due}} for {{student_full_name}} for the {{season_name}} season.

Thank you for your support.`,
  sponsor_acknowledgment: `Dear {{contact_name}},

Thank you for your generous {{level_name}} sponsorship of {{sponsorship_amount}} for {{term_label}}.

Your support makes our work possible.`,
};

/**
 * A sponsors-only org following the sponsor-letters empty-state link should
 * land on a form already set to Sponsor Acknowledgment, not Season Balance —
 * the type can never be changed after creation, so guessing wrong here means
 * deleting and recreating the template.
 */
function defaultTemplateType(
  seasonsEnabled: boolean,
  sponsorsEnabled: boolean
): LetterTemplateType {
  if (sponsorsEnabled && !seasonsEnabled) return "sponsor_acknowledgment";
  return "season_balance";
}

export function LetterTemplateForm({
  mode,
  orgId,
  seasonsEnabled,
  sponsorsEnabled,
  defaultValues,
}: Readonly<{
  mode: "create" | "edit";
  orgId: string;
  seasonsEnabled: boolean;
  sponsorsEnabled: boolean;
  defaultValues?: LetterTemplateDefaults;
}>) {
  const action =
    mode === "create" ? createLetterTemplate : updateLetterTemplate;
  const [state, formAction, pending] = useActionState(action, null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [selectedType, setSelectedType] = useState<LetterTemplateType>(
    defaultValues?.template_type ??
      defaultTemplateType(seasonsEnabled, sponsorsEnabled)
  );
  // Only the types this org's flags allow — on edit, the type is fixed and
  // the control is disabled anyway, so the current value is always offered
  // even if the org's flags changed after creation.
  const availableTypes =
    mode === "edit" && defaultValues
      ? [defaultValues.template_type]
      : LETTER_TEMPLATE_TYPES.filter((type) =>
          type === "season_balance" ? seasonsEnabled : sponsorsEnabled
        );
  const sampleTokenValues =
    selectedType === "sponsor_acknowledgment"
      ? SAMPLE_SPONSOR_TOKEN_VALUES
      : SAMPLE_SEASON_TOKEN_VALUES;
  const [heading, setHeading] = useState(defaultValues?.heading ?? "");
  const [body, setBody] = useState(
    defaultValues?.body ??
      (mode === "create" ? STARTER_BODY_BY_TYPE[selectedType] : "")
  );
  const [closing, setClosing] = useState(
    defaultValues?.closing ?? (mode === "create" ? DEFAULT_CLOSING : "")
  );
  const [isDefault, setIsDefault] = useState(
    defaultValues?.is_default ?? false
  );

  function insertPlaceholder(token: string): void {
    const snippet = `{{${token}}}`;
    const textarea = bodyRef.current;

    if (!textarea) {
      setBody((current) => current + snippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setBody((current) => current.slice(0, start) + snippet + current.slice(end));

    // Restore the caret after React re-renders with the new value.
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + snippet.length;
      textarea.setSelectionRange(caret, caret);
    });
  }

  const previewHeading = renderTemplate(heading, sampleTokenValues).trim();
  const previewBody = renderTemplate(body, sampleTokenValues);
  const previewClosing = renderTemplate(closing, sampleTokenValues).trim();

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="self-start" asChild>
        <Link href={`/organizations/${orgId}/letter-templates`}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to templates
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organization_id" value={orgId} />
          {mode === "edit" && defaultValues && (
            <input type="hidden" name="id" value={defaultValues.id} />
          )}
          <input
            type="hidden"
            name="is_default"
            value={isDefault ? "true" : "false"}
          />

          {state?.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              name="name"
              required
              maxLength={100}
              defaultValue={defaultValues?.name ?? ""}
              placeholder="First Notice"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-type">Template Type</Label>
            <Select
              value={selectedType}
              onValueChange={(value) =>
                setSelectedType(value as LetterTemplateType)
              }
              disabled={mode === "edit"}
            >
              <SelectTrigger id="template-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {LETTER_TEMPLATE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="template_type" value={selectedType} />
            {mode === "edit" && (
              <p className="text-sm text-muted-foreground">
                Template type can&rsquo;t be changed after creation — delete
                and recreate the template to switch types.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-heading">Heading (optional)</Label>
            <Input
              id="template-heading"
              name="heading"
              maxLength={150}
              value={heading}
              onChange={(event) => setHeading(event.target.value)}
              placeholder="Outstanding Balance Notice"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-body">Letter Body</Label>
            <Textarea
              id="template-body"
              name="body"
              ref={bodyRef}
              required
              maxLength={5000}
              rows={14}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Leave a blank line between paragraphs. Include your greeting here,
              for example &ldquo;Dear &#123;&#123;guardian_name&#125;&#125;,&rdquo;.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Insert a placeholder</Label>
            <div className="flex flex-wrap gap-1.5">
              {getPlaceholders(selectedType).map((placeholder) => (
                <Button
                  key={placeholder.token}
                  type="button"
                  variant="outline"
                  size="sm"
                  title={placeholder.description}
                  onClick={() => insertPlaceholder(placeholder.token)}
                >
                  {placeholder.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-closing">Closing (optional)</Label>
            <Input
              id="template-closing"
              name="closing"
              maxLength={300}
              value={closing}
              onChange={(event) => setClosing(event.target.value)}
              placeholder="Sincerely,"
            />
            <p className="text-sm text-muted-foreground">
              The director&rsquo;s name and title are printed below this
              automatically, from your organization settings.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="template-default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="template-default">Make this the default</Label>
              <p className="text-sm text-muted-foreground">
                Pre-selected when you generate letters for a season.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : mode === "create"
                  ? "Create Template"
                  : "Save Changes"}
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/organizations/${orgId}/letter-templates`}>
                Cancel
              </Link>
            </Button>
          </div>
        </form>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Rendered with sample data. Real letters use each student&rsquo;s
              own numbers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <p className="text-base font-semibold">Your Organization</p>

            {previewHeading && (
              <p className="font-semibold">{previewHeading}</p>
            )}

            <div className="whitespace-pre-wrap">{previewBody}</div>

            {selectedType === "season_balance" && (
              <div className="rounded-md border border-border p-3">
                <div className="flex justify-between">
                  <span>Season Fee</span>
                  <span className="tabular-nums">
                    {sampleTokenValues.fee_amount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Paid</span>
                  <span className="tabular-nums">
                    {sampleTokenValues.total_paid}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Balance Due</span>
                  <span className="tabular-nums">
                    {sampleTokenValues.balance_due}
                  </span>
                </div>
              </div>
            )}

            {previewClosing && <p>{previewClosing}</p>}

            <div className="text-muted-foreground">
              <p>{sampleTokenValues.director_name}</p>
              <p>{sampleTokenValues.director_title}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
