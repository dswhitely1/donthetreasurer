"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, changePassword, deleteAccount } from "./actions";

interface SettingsFormProps {
  name: string;
  email: string;
}

function FormMessage({ error, success }: Readonly<{ error?: string; success?: boolean }>) {
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }
  if (success) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Updated successfully.
      </div>
    );
  }
  return null;
}

export function SettingsForm({ name, email }: Readonly<SettingsFormProps>) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, null);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, null);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAccount, null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const passwordFormRef = useRef<HTMLFormElement>(null);

  const profileSuccess = profileState !== null && "success" in profileState;
  const passwordSuccess = passwordState !== null && "success" in passwordState;

  return (
    <div className="space-y-6">
      {/* Profile section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                name="name"
                defaultValue={name}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed.
              </p>
            </div>
            {profileState && (
              <FormMessage
                error={"error" in profileState ? profileState.error : undefined}
                success={profileSuccess}
              />
            )}
            <Button type="submit" disabled={profilePending}>
              {profilePending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Change your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={passwordFormRef}
            action={async (formData) => {
              await passwordAction(formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {passwordState && (
              <FormMessage
                error={"error" in passwordState ? passwordState.error : undefined}
                success={passwordSuccess}
              />
            )}
            <Button type="submit" disabled={passwordPending}>
              {passwordPending ? "Updating..." : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete account
            </Button>
          ) : (
            <form action={deleteAction} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will permanently delete your account, all organizations,
                accounts, transactions, and related data. This action cannot be
                undone.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirmation">
                  Type <span className="font-semibold">DELETE</span> to confirm
                </Label>
                <Input
                  id="delete-confirmation"
                  name="confirmation"
                  required
                  autoComplete="off"
                  placeholder="DELETE"
                />
              </div>
              {deleteState?.error && (
                <FormMessage error={deleteState.error} />
              )}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting..." : "Permanently delete account"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
