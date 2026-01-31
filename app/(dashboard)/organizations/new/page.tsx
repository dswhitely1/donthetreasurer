"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createOrganization } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function NewOrganizationPage() {
  const [state, formAction, pending] = useActionState(
    createOrganization,
    null
  );

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/organizations"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to organizations
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New Organization</CardTitle>
          <CardDescription>
            Add a 501(c)(3) nonprofit organization to manage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            {state?.error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Corydon Community Foundation"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ein">EIN (optional)</Label>
              <Input
                id="ein"
                name="ein"
                placeholder="XX-XXXXXXX"
                maxLength={10}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscal_year_start_month">
                Fiscal Year Start Month
              </Label>
              <Select name="fiscal_year_start_month" defaultValue="1">
                <SelectTrigger id="fiscal_year_start_month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-2 flex gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Creating\u2026" : "Create Organization"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/organizations">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
