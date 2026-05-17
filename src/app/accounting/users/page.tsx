"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeSession } from "@/lib/auth-session";

type AccessLevel = "owner" | "admin";

type AccountingUser = {
  id: string;
  profile_id: string | null;
  display_name: string;
  email: string;
  access_level: AccessLevel;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
};

type CreateForm = {
  displayName: string;
  email: string;
  accessLevel: AccessLevel;
};

function accessLevelLabel(level: AccessLevel) {
  return { owner: "Owner", admin: "Admin" }[level] ?? level;
}

function accessLevelClasses(level: AccessLevel) {
  return {
    owner: "bg-[#1f2428] text-white",
    admin: "bg-[#efe7f5] text-[#674b7a]",
  }[level] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function CreateUserModal({
  saving,
  error,
  onClose,
  onCreate,
}: {
  saving: boolean;
  error: string;
  onClose: () => void;
  onCreate: (form: CreateForm) => void;
}) {
  const [form, setForm] = useState<CreateForm>({
    displayName: "",
    email: "",
    accessLevel: "admin",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-lg rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#236c8f]">Accounting Users</p>
            <h3 className="mt-1 text-xl font-semibold">Create accounting user</h3>
            <p className="mt-1 text-sm text-[#697178]">
              A random temporary password will be shown once after creation.
            </p>
          </div>
          <button
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Display name
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Jane Smith"
                value={form.displayName}
              />
            </label>
            <label className="text-sm font-semibold">
              Email
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
                type="email"
                value={form.email}
              />
            </label>
          </div>

          <label className="block text-sm font-semibold">
            Access level
            <select
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(e) =>
                setForm((f) => ({ ...f, accessLevel: e.target.value as AccessLevel }))
              }
              value={form.accessLevel}
            >
              <option value="admin">Admin — can manage accounting users</option>
              <option value="owner">Owner — full accounting access</option>
            </select>
          </label>

          <button
            className="h-10 w-full rounded-md bg-[#236c8f] px-4 text-sm font-semibold text-white hover:bg-[#1a5470] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={() => onCreate(form)}
            type="button"
          >
            {saving ? "Creating..." : "Create user"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TempPasswordModal({
  displayName,
  email,
  tempPassword,
  onClose,
}: {
  displayName: string;
  email: string;
  tempPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyPassword() {
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-md rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="border-b border-[#e5dfd4] px-5 py-4">
          <p className="text-xs font-semibold text-[#476b33]">User created</p>
          <h3 className="mt-1 text-xl font-semibold">Temporary password</h3>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="rounded-md bg-[#fff8e5] px-3 py-2 text-sm font-semibold text-[#7a5c00]">
            Copy this password now. It will not be shown again.
          </p>

          <div>
            <p className="text-sm text-[#697178]">
              Account: <strong>{displayName}</strong> ({email})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-[#cfc7b8] bg-[#f7f2e9] px-3 py-2 font-mono text-sm font-semibold tracking-wider">
              {tempPassword}
            </code>
            <button
              className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd]"
              onClick={copyPassword}
              type="button"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <p className="text-sm text-[#697178]">
            The user will be asked to set a new password on first login.
          </p>

          <button
            className="h-10 w-full rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AccountingUsersPage() {
  const [users, setUsers] = useState<AccountingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newTempPassword, setNewTempPassword] = useState<{
    displayName: string;
    email: string;
    password: string;
  } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const session = await getSafeSession();
    return session?.access_token ?? null;
  }, []);

  const loadUsers = useCallback(async () => {
    const token = await getToken();

    setLoading(true);
    setError("");

    if (!token) {
      setError("Please log in.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/accounting/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { users?: AccountingUser[]; error?: string };

    if (!res.ok) {
      setError(data.error ?? "Failed to load users.");
    } else {
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  async function createUser(form: CreateForm) {
    const displayName = form.displayName.trim();
    const email = form.email.trim().toLowerCase();

    if (!displayName) {
      setCreateError("Display name is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setCreateError("Enter a valid email address.");
      return;
    }

    setSaving(true);
    setCreateError("");

    const token = await getToken();
    if (!token) {
      setCreateError("Please log in again.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/accounting/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName, email, accessLevel: form.accessLevel }),
    });

    const data = (await res.json()) as {
      user?: AccountingUser;
      tempPassword?: string;
      error?: string;
    };

    if (!res.ok || !data.user) {
      setCreateError(data.error ?? "Failed to create user.");
      setSaving(false);
      return;
    }

    setUsers((current) => [data.user!, ...current]);
    setShowCreate(false);
    setNewTempPassword({
      displayName: data.user.display_name,
      email: data.user.email,
      password: data.tempPassword!,
    });
    setSaving(false);
  }

  async function toggleActive(user: AccountingUser) {
    setTogglingId(user.id);

    const token = await getToken();
    if (!token) {
      setTogglingId(null);
      return;
    }

    const res = await fetch(`/api/accounting/users/${user.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: !user.active }),
    });

    const data = (await res.json()) as { user?: AccountingUser; error?: string };

    if (res.ok && data.user) {
      setUsers((current) => current.map((u) => (u.id === user.id ? data.user! : u)));
    }
    setTogglingId(null);
  }

  async function deleteUser(user: AccountingUser) {
    const confirmed = window.confirm(
      `Delete ${user.display_name}? This removes the accounting user and linked login account.`,
    );
    if (!confirmed) return;

    setDeletingId(user.id);
    setError("");

    const token = await getToken();
    if (!token) {
      setDeletingId(null);
      setError("Please log in again.");
      return;
    }

    const res = await fetch(`/api/accounting/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };

    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to delete user.");
      setDeletingId(null);
      return;
    }

    setUsers((current) => current.filter((u) => u.id !== user.id));
    setDeletingId(null);
  }

  return (
    <AccountingShell
      active="Users"
      eyebrow="Access control"
      title="Accounting users"
      description="Manage who can access the accounting app. Accounts are separate from Tattoo Manager staff."
      actions={
        <button
          className="h-10 rounded-md bg-[#236c8f] px-4 text-sm font-semibold text-white hover:bg-[#1a5470]"
          onClick={() => {
            setCreateError("");
            setShowCreate(true);
          }}
          type="button"
        >
          Create user
        </button>
      }
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading users...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 shadow-sm">
          <p className="text-sm font-semibold text-[#8a3030]">{error}</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-4 py-4">
            <h3 className="text-base font-semibold">
              {users.length} {users.length === 1 ? "user" : "users"}
            </h3>
          </div>

          {users.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[#697178]">
              No accounting users yet. Create one to get started.
            </p>
          ) : (
            <>
              {/* Mobile list */}
              <div className="divide-y divide-[#eee8dd] md:hidden">
                {users.map((user) => (
                  <div key={user.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{user.display_name}</p>
                        <p className="mt-0.5 truncate text-sm text-[#697178]">{user.email}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${accessLevelClasses(user.access_level)}`}
                      >
                        {accessLevelLabel(user.access_level)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${
                            user.active
                              ? "bg-[#e4f1df] text-[#476b33]"
                              : "bg-[#f3e1e1] text-[#8a3030]"
                          }`}
                        >
                          {user.active ? "Active" : "Inactive"}
                        </span>
                        {user.must_change_password ? (
                          <span className="rounded-md bg-[#fff8e5] px-2 py-1 text-xs font-semibold text-[#7a5c00]">
                            Temp password
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="text-xs font-semibold text-[#236c8f] hover:underline disabled:opacity-50"
                          disabled={togglingId === user.id}
                          onClick={() => toggleActive(user)}
                          type="button"
                        >
                          {user.active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          className="text-xs font-semibold text-[#8a3030] hover:underline disabled:opacity-50"
                          disabled={deletingId === user.id}
                          onClick={() => deleteUser(user)}
                          type="button"
                        >
                          {deletingId === user.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#f7f2e9] text-xs uppercase text-[#6f7275]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Access level</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Password</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8dd]">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-[#fdfbf7]">
                        <td className="px-4 py-4">
                          <p className="font-semibold">{user.display_name}</p>
                          <p className="mt-0.5 text-[#697178]">{user.email}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-semibold ${accessLevelClasses(user.access_level)}`}
                          >
                            {accessLevelLabel(user.access_level)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-semibold ${
                              user.active
                                ? "bg-[#e4f1df] text-[#476b33]"
                                : "bg-[#f3e1e1] text-[#8a3030]"
                            }`}
                          >
                            {user.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {user.must_change_password ? (
                            <span className="rounded-md bg-[#fff8e5] px-2 py-1 text-xs font-semibold text-[#7a5c00]">
                              Temp (not changed)
                            </span>
                          ) : (
                            <span className="text-xs text-[#697178]">Set</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              className="text-sm font-semibold text-[#236c8f] hover:underline disabled:opacity-50"
                              disabled={togglingId === user.id}
                              onClick={() => toggleActive(user)}
                              type="button"
                            >
                              {togglingId === user.id
                                ? "Saving..."
                                : user.active
                                  ? "Deactivate"
                                  : "Reactivate"}
                            </button>
                            <button
                              className="text-sm font-semibold text-[#8a3030] hover:underline disabled:opacity-50"
                              disabled={deletingId === user.id}
                              onClick={() => deleteUser(user)}
                              type="button"
                            >
                              {deletingId === user.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {showCreate ? (
        <CreateUserModal
          error={createError}
          onClose={() => setShowCreate(false)}
          onCreate={createUser}
          saving={saving}
        />
      ) : null}

      {newTempPassword ? (
        <TempPasswordModal
          displayName={newTempPassword.displayName}
          email={newTempPassword.email}
          onClose={() => setNewTempPassword(null)}
          tempPassword={newTempPassword.password}
        />
      ) : null}
    </AccountingShell>
  );
}
