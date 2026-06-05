import React, { useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Users, Plus, Receipt, AlertCircle, Loader2 } from "lucide-react";

async function apiFetch(url: string, token: string, options?: Omit<RequestInit, "body"> & { body?: unknown }) {
  const { body, ...rest } = options ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, ...(rest.headers ?? {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(errBody));
  }
  return res.json();
}

interface AccountRow {
  account_id: string | null;
  student_id: string;
  student_name: string | null;
  grade: string;
  balance_cents: number;
  balance_display: string;
}

interface LedgerEntry {
  id: string;
  amount_cents: number;
  amount_display: string;
  type: string;
  description: string | null;
  created_at: string | null;
}

interface AccountDetail {
  balance_cents: number;
  balance_display: string;
  ledger: LedgerEntry[];
}

const TYPE_META: Record<string, { label: string; className: string }> = {
  charge: { label: "Charge", className: "bg-orange-100 text-orange-700" },
  payment: { label: "Payment", className: "bg-green-100 text-green-700" },
  adjustment: { label: "Adjustment", className: "bg-blue-100 text-blue-700" },
};

export default function AdminFees() {
  const { profile, school, session } = useAuth();
  const qc = useQueryClient();
  const schoolId = school?.id ?? profile?.school_id ?? "";

  const [chargeOpen, setChargeOpen] = useState(false);
  const [selected, setSelected] = useState<AccountRow | null>(null);
  const [chargeType, setChargeType] = useState<"charge" | "adjustment">("charge");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [chargeError, setChargeError] = useState<string | null>(null);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerStudent, setLedgerStudent] = useState<AccountRow | null>(null);

  const { data: accounts = [] } = useQuery<AccountRow[]>({
    queryKey: ["fee-accounts", schoolId],
    queryFn: () => apiFetch(`/api/fees/accounts?school_id=${schoolId}`, session?.access_token ?? ""),
    enabled: !!schoolId,
  });

  const { data: ledgerDetail } = useQuery<AccountDetail>({
    queryKey: ["fee-account", ledgerStudent?.student_id],
    queryFn: () => apiFetch(`/api/fees/account?student_id=${ledgerStudent?.student_id}`, session?.access_token ?? ""),
    enabled: ledgerOpen && !!ledgerStudent?.student_id,
  });

  const chargeMutation = useMutation({
    mutationFn: (body: unknown) => apiFetch("/api/fees/charge", session?.access_token ?? "", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-accounts", schoolId] });
      qc.invalidateQueries({ queryKey: ["fee-account"] });
      setChargeOpen(false);
      setAmount("");
      setNote("");
    },
    onError: (err: Error) => {
      try {
        const json = JSON.parse(err.message);
        setChargeError(json.error ?? "Failed to save");
      } catch {
        setChargeError("Failed to save");
      }
    },
  });

  function openCharge(row: AccountRow, type: "charge" | "adjustment") {
    setSelected(row);
    setChargeType(type);
    setAmount("");
    setNote("");
    setChargeError(null);
    setChargeOpen(true);
  }

  function openLedger(row: AccountRow) {
    setLedgerStudent(row);
    setLedgerOpen(true);
  }

  function submitCharge() {
    if (!selected) return;
    const value = parseFloat(amount || "0");
    if (!value) { setChargeError("Enter a non-zero amount"); return; }
    const cents = Math.round(value * 100);
    setChargeError(null);
    chargeMutation.mutate({
      student_id: selected.student_id,
      amount_cents: cents,
      type: chargeType,
      description: note || (chargeType === "charge" ? "Fee charge" : "Adjustment"),
    });
  }

  const totalOutstanding = accounts.reduce((s, a) => s + Math.max(0, a.balance_cents), 0);
  const owingCount = accounts.filter(a => a.balance_cents > 0).length;

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Fees</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage student fee accounts, charges and adjustments</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 bg-rose-50 rounded-lg"><Wallet className="h-5 w-5 text-rose-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total Outstanding</p>
                <p className="text-xl font-bold text-gray-900">R {(totalOutstanding / 100).toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 bg-blue-50 rounded-lg"><Users className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Students With Balance</p>
                <p className="text-xl font-bold text-gray-900">{owingCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accounts */}
        {accounts.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-gray-400">No students found for this school</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {accounts.map(row => {
              const owes = row.balance_cents > 0;
              const credit = row.balance_cents < 0;
              return (
                <Card key={row.student_id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{row.student_name ?? "Unknown Student"}</p>
                      <p className="text-sm text-gray-500">
                        Grade {row.grade} · Balance:{" "}
                        <span className={`font-bold ${owes ? "text-rose-600" : credit ? "text-green-600" : "text-gray-600"}`}>
                          R {row.balance_display}
                        </span>
                        {credit && <span className="text-green-600"> (in credit)</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openLedger(row)}>
                        <Receipt className="h-3.5 w-3.5 mr-1" />History
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openCharge(row, "adjustment")}>
                        Adjust
                      </Button>
                      <Button size="sm" onClick={() => openCharge(row, "charge")}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Charge
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Charge / Adjust dialog */}
      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{chargeType === "charge" ? "Add Charge" : "Adjustment"} — {selected?.student_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Current balance: <span className="font-bold text-gray-800">R {selected?.balance_display}</span></p>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={chargeType} onValueChange={(v) => setChargeType(v as "charge" | "adjustment")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="charge">Charge (increase balance owed)</SelectItem>
                  <SelectItem value="adjustment">Adjustment (+ owe / − credit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (R){chargeType === "adjustment" && <span className="text-xs text-gray-400"> — use a negative value to credit</span>}</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Input placeholder={chargeType === "charge" ? "e.g. Term 3 tuition" : "e.g. Bursary credit"} value={note} onChange={e => setNote(e.target.value)} className="mt-1" />
            </div>
            {chargeError && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{chargeError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeOpen(false)}>Cancel</Button>
            <Button onClick={submitCharge} disabled={!amount || chargeMutation.isPending}>
              {chargeMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger dialog */}
      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ledgerStudent?.student_name} — Statement</DialogTitle>
          </DialogHeader>
          {ledgerDetail && (
            <div className="p-3 bg-gray-50 rounded-lg mb-2">
              <p className="text-sm text-gray-500">Balance: <span className="font-bold text-gray-800">R {ledgerDetail.balance_display}</span></p>
            </div>
          )}
          {!ledgerDetail ? (
            <p className="text-center text-gray-400 py-8">Loading…</p>
          ) : ledgerDetail.ledger.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {ledgerDetail.ledger.map(entry => {
                const meta = TYPE_META[entry.type] ?? { label: entry.type, className: "bg-gray-100 text-gray-700" };
                const credit = entry.amount_cents < 0;
                return (
                  <div key={entry.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>
                        <span className="text-xs text-gray-400">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ""}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{entry.description}</p>
                    </div>
                    <p className={`font-bold ${credit ? "text-green-600" : "text-gray-900"}`}>R {entry.amount_display}</p>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
