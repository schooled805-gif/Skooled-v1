import React, { useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, CreditCard, AlertCircle, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";

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

interface LedgerEntry {
  id: string;
  amount_cents: number;
  amount_display: string;
  type: string;
  description: string | null;
  created_at: string | null;
}

interface FeeAccount {
  id: string;
  student_id: string;
  student_name: string | null;
  balance_cents: number;
  balance_display: string;
  ledger: LedgerEntry[];
}

interface Providers { paystack: boolean; ozow: boolean }

const TYPE_META: Record<string, { label: string; className: string }> = {
  charge: { label: "Charge", className: "bg-orange-100 text-orange-700" },
  payment: { label: "Payment", className: "bg-green-100 text-green-700" },
  adjustment: { label: "Adjustment", className: "bg-blue-100 text-blue-700" },
};

export default function ParentAccount() {
  const { profile, school, user, session } = useAuth();
  const qc = useQueryClient();
  const schoolId = school?.id ?? profile?.school_id ?? "";

  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payProvider, setPayProvider] = useState<"paystack" | "ozow" | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const { data: links = [] } = useQuery<{ student_id: string; student_name: string; school_id: string }[]>({
    queryKey: ["parent-links", user?.id],
    queryFn: () => apiFetch(`/api/parent-student-links?parent_user_id=${user?.id}`, session?.access_token ?? ""),
    enabled: !!user?.id,
  });

  const activeChild = selectedChild ?? links[0]?.student_id ?? null;
  const activeChildName = links.find(l => l.student_id === activeChild)?.student_name ?? "Child";

  const { data: account } = useQuery<FeeAccount>({
    queryKey: ["fee-account", activeChild],
    queryFn: () => apiFetch(`/api/fees/account?student_id=${activeChild}`, session?.access_token ?? ""),
    enabled: !!activeChild,
  });

  const { data: providers } = useQuery<Providers>({
    queryKey: ["fee-providers"],
    queryFn: () => apiFetch(`/api/fees/providers`, session?.access_token ?? ""),
    enabled: !!session?.access_token,
  });

  const initiatePayment = useMutation({
    mutationFn: (body: unknown) => apiFetch("/api/fees/pay/initiate", session?.access_token ?? "", { method: "POST", body }),
    onSuccess: (data: { redirect_url?: string }) => {
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setPayError("Could not start payment. Please try again.");
      }
    },
    onError: (err: Error) => {
      try {
        const json = JSON.parse(err.message);
        setPayError(json.error ?? "Failed to start payment");
      } catch {
        setPayError("Failed to start payment");
      }
    },
  });

  const balanceCents = account?.balance_cents ?? 0;
  const owes = balanceCents > 0;
  const inCredit = balanceCents < 0;

  function openPay() {
    setPayError(null);
    setPayAmount(owes ? (balanceCents / 100).toFixed(2) : "");
    const available = providers?.paystack ? "paystack" : providers?.ozow ? "ozow" : null;
    setPayProvider(available);
    setPayOpen(true);
  }

  function submitPayment() {
    if (!activeChild || !payProvider) return;
    const cents = Math.round(parseFloat(payAmount || "0") * 100);
    if (!cents || cents <= 0) { setPayError("Enter an amount greater than 0"); return; }
    setPayError(null);
    initiatePayment.mutate({
      student_id: activeChild,
      amount_cents: cents,
      provider: payProvider,
      return_url: window.location.href,
    });
  }

  const anyProvider = !!(providers?.paystack || providers?.ozow);

  return (
    <PortalLayout role="parent">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Fees</h1>
          <p className="text-sm text-gray-500">View your child's fee account and pay online</p>
        </div>

        {/* Child selector */}
        {links.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {links.map(l => (
              <Button
                key={l.student_id}
                variant={activeChild === l.student_id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedChild(l.student_id)}
              >
                {l.student_name}
              </Button>
            ))}
          </div>
        )}

        {/* Balance card */}
        {account && (
          <Card className={`text-white ${owes ? "bg-gradient-to-r from-rose-600 to-rose-700" : "bg-gradient-to-r from-emerald-600 to-emerald-700"}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white/80 text-sm">{activeChildName}'s Fee Account</p>
                  <p className="text-3xl font-bold mt-1">R {centsAbs(balanceCents)}</p>
                  <p className="text-white/90 text-xs mt-1 flex items-center gap-1">
                    {owes && (<><AlertCircle className="h-3.5 w-3.5" />Outstanding balance due</>)}
                    {inCredit && (<>Account in credit</>)}
                    {!owes && !inCredit && (<>No outstanding balance</>)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Wallet className="h-8 w-8 text-white/70" />
                  {anyProvider ? (
                    <Button
                      size="sm"
                      className="bg-white text-gray-800 hover:bg-gray-100"
                      onClick={openPay}
                    >
                      <CreditCard className="h-3.5 w-3.5 mr-1" />Pay now
                    </Button>
                  ) : (
                    <div className="text-right">
                      <Button size="sm" disabled className="bg-white/40 text-white cursor-not-allowed">
                        <CreditCard className="h-3.5 w-3.5 mr-1" />Pay now
                      </Button>
                      <p className="text-[10px] text-white/80 mt-1 max-w-[150px] leading-tight">
                        Online payments not set up by your school yet
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Transaction History</h2>
          {!account || account.ledger.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-gray-400">No transactions yet</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {account.ledger.map(entry => {
                const meta = TYPE_META[entry.type] ?? { label: entry.type, className: "bg-gray-100 text-gray-700" };
                const credit = entry.amount_cents < 0;
                return (
                  <Card key={entry.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {credit
                          ? <ArrowDownCircle className="h-5 w-5 text-green-500" />
                          : <ArrowUpCircle className="h-5 w-5 text-orange-500" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>
                            <span className="text-xs text-gray-400">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ""}</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5">{entry.description}</p>
                        </div>
                      </div>
                      <p className={`font-bold ${credit ? "text-green-600" : "text-gray-900"}`}>R {entry.amount_display}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pay dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pay School Fees — {activeChildName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (R)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="mt-1" />
              {owes && (
                <p className="text-xs text-gray-500 mt-1">Outstanding: R {centsAbs(balanceCents)}</p>
              )}
            </div>
            <div>
              <Label>Payment method</Label>
              <div className="flex gap-2 mt-1">
                {providers?.paystack && (
                  <Button
                    type="button"
                    variant={payProvider === "paystack" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setPayProvider("paystack")}
                  >
                    Paystack
                  </Button>
                )}
                {providers?.ozow && (
                  <Button
                    type="button"
                    variant={payProvider === "ozow" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setPayProvider("ozow")}
                  >
                    Ozow
                  </Button>
                )}
              </div>
            </div>
            {payError && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{payError}</p>}
            <p className="text-[11px] text-gray-400 leading-tight">
              You'll be redirected to {payProvider === "ozow" ? "Ozow" : "Paystack"} to complete payment securely. Your balance updates once the payment is confirmed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={initiatePayment.isPending || !payProvider}>
              {initiatePayment.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redirecting…</> : "Continue to payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

function centsAbs(cents: number) {
  return (Math.abs(cents) / 100).toFixed(2);
}
