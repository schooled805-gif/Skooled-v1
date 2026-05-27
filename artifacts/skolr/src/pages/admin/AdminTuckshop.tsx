import React, { useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  ShoppingBag, Plus, Trash2, Edit2, Wallet, ClipboardList,
  CheckCircle, Package, Users, DollarSign,
} from "lucide-react";

async function apiFetch(url: string, userId: string, options?: RequestInit & { body?: unknown }) {
  const { body, ...rest } = options ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", "x-user-id": userId, ...(rest.headers ?? {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(errBody));
  }
  return res.json();
}

interface MenuItem {
  id: string;
  name: string;
  price: number; // cents
  category: string;
  description: string;
  available: boolean;
}

interface Menu {
  id: string;
  week_label: string;
  items: MenuItem[];
  published_at: string;
}

interface Order {
  id: string;
  student_id: string;
  items: { name: string; price: number; quantity: number }[];
  total_cents: number;
  total_display: string;
  status: string;
  order_date: string;
  created_at: string;
}

interface Account {
  id: string;
  student_id: string;
  student_name: string;
  balance_cents: number;
  balance_display: string;
}

const CATEGORIES = ["Mains", "Sides", "Snacks", "Drinks", "Desserts"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  ready: "bg-purple-100 text-purple-800",
  collected: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminTuckshop() {
  const { profile, school, user } = useAuth();
  const qc = useQueryClient();
  const schoolId = school?.id ?? profile?.schoolId ?? "";

  const [activeTab, setActiveTab] = useState("menu");
  const [menuDialog, setMenuDialog] = useState(false);
  const [editMenu, setEditMenu] = useState<Menu | null>(null);
  const [weekLabel, setWeekLabel] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [topupDialog, setTopupDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupNote, setTopupNote] = useState("");

  const { data: menus = [] } = useQuery<Menu[]>({
    queryKey: ["tuckshop-menus", schoolId],
    queryFn: () => apiFetch(`/api/tuckshop/menus?school_id=${schoolId}`, user?.id ?? ""),
    enabled: !!schoolId,
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["tuckshop-orders-admin", schoolId],
    queryFn: () => apiFetch(`/api/tuckshop/orders?school_id=${schoolId}`, user?.id ?? ""),
    enabled: !!schoolId,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["tuckshop-accounts", schoolId],
    queryFn: () => apiFetch(`/api/tuckshop/accounts?school_id=${schoolId}`, user?.id ?? ""),
    enabled: !!schoolId,
  });

  const publishMenu = useMutation({
    mutationFn: (body: object) => apiFetch("/api/tuckshop/menu", user?.id ?? "", { method: "POST", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tuckshop-menus"] }); setMenuDialog(false); },
  });

  const updateMenu = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiFetch(`/api/tuckshop/menu/${id}`, user?.id ?? "", { method: "PATCH", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tuckshop-menus"] }); setMenuDialog(false); },
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/tuckshop/orders/${id}`, user?.id ?? "", { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tuckshop-orders-admin"] }),
  });

  const topupMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/api/tuckshop/topup", user?.id ?? "", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tuckshop-accounts"] });
      setTopupDialog(false);
      setTopupAmount("");
      setTopupNote("");
    },
  });

  function openNewMenu() {
    setEditMenu(null);
    setWeekLabel("");
    setMenuItems([{ id: crypto.randomUUID(), name: "", price: 0, category: "Mains", description: "", available: true }]);
    setMenuDialog(true);
  }

  function openEditMenu(m: Menu) {
    setEditMenu(m);
    setWeekLabel(m.week_label);
    setMenuItems(m.items.length ? m.items : [{ id: crypto.randomUUID(), name: "", price: 0, category: "Mains", description: "", available: true }]);
    setMenuDialog(true);
  }

  function addItem() {
    setMenuItems(prev => [...prev, { id: crypto.randomUUID(), name: "", price: 0, category: "Mains", description: "", available: true }]);
  }

  function removeItem(id: string) {
    setMenuItems(prev => prev.filter(i => i.id !== id));
  }

  function updateItem(id: string, field: keyof MenuItem, value: string | number | boolean) {
    setMenuItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function saveMenu() {
    const validItems = menuItems.filter(i => i.name.trim());
    const body = { school_id: schoolId, week_label: weekLabel, items: validItems };
    if (editMenu) updateMenu.mutate({ id: editMenu.id, body });
    else publishMenu.mutate(body);
  }

  function doTopup() {
    if (!selectedAccount || !topupAmount) return;
    topupMutation.mutate({
      student_id: selectedAccount.student_id,
      amount_cents: Math.round(parseFloat(topupAmount) * 100),
      description: topupNote || "Admin top-up",
    });
  }

  const pendingOrders = orders.filter(o => o.status === "pending");
  const totalBalance = accounts.reduce((s, a) => s + a.balance_cents, 0);

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tuckshop</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage menus, orders and student balances</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 bg-yellow-50 rounded-lg"><ClipboardList className="h-5 w-5 text-yellow-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Pending Orders</p>
                <p className="text-xl font-bold text-gray-900">{pendingOrders.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 bg-green-50 rounded-lg"><Wallet className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total Balances</p>
                <p className="text-xl font-bold text-gray-900">R {(totalBalance / 100).toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 bg-blue-50 rounded-lg"><Users className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Active Accounts</p>
                <p className="text-xl font-bold text-gray-900">{accounts.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="menu">Weekly Menu</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="balances">Student Balances</TabsTrigger>
          </TabsList>

          {/* ── MENU TAB ── */}
          <TabsContent value="menu" className="mt-4">
            <div className="flex justify-end mb-3">
              <Button onClick={openNewMenu}><Plus className="h-4 w-4 mr-2" />Publish New Menu</Button>
            </div>
            {menus.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-gray-400">No menus published yet</CardContent></Card>
            ) : (
              <div className="space-y-4">
                {menus.map((m, idx) => (
                  <Card key={m.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{m.week_label}</CardTitle>
                          <p className="text-xs text-gray-400">
                            {idx === 0 ? <span className="text-green-600 font-medium">✓ Current</span> : null}
                            {" "}Published {new Date(m.published_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => openEditMenu(m)}>
                          <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {m.items.map(item => (
                          <div key={item.id} className={`p-2 rounded-lg border text-sm ${item.available ? "bg-white" : "bg-gray-50 opacity-60"}`}>
                            <p className="font-medium text-gray-800">{item.name}</p>
                            <p className="text-gray-500 text-xs">{item.category}</p>
                            <p className="font-bold text-gray-900 text-sm mt-1">R {(item.price / 100).toFixed(2)}</p>
                            {!item.available && <p className="text-xs text-red-500">Unavailable</p>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── ORDERS TAB ── */}
          <TabsContent value="orders" className="mt-4">
            {orders.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-gray-400">No orders yet</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {orders.map(order => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}`}>
                              {order.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-400">{order.order_date}</span>
                          </div>
                          <div className="text-sm text-gray-700">
                            {order.items.map((i, idx) => (
                              <span key={idx}>{i.quantity}× {i.name}{idx < order.items.length - 1 ? ", " : ""}</span>
                            ))}
                          </div>
                          <p className="font-bold text-gray-900 mt-1">R {order.total_display}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {order.status === "pending" && (
                            <Button size="sm" variant="outline" className="text-blue-600 border-blue-200"
                              onClick={() => updateOrder.mutate({ id: order.id, status: "confirmed" })}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />Confirm
                            </Button>
                          )}
                          {order.status === "confirmed" && (
                            <Button size="sm" variant="outline" className="text-purple-600 border-purple-200"
                              onClick={() => updateOrder.mutate({ id: order.id, status: "ready" })}>
                              <Package className="h-3.5 w-3.5 mr-1" />Mark Ready
                            </Button>
                          )}
                          {order.status === "ready" && (
                            <Button size="sm" variant="outline" className="text-green-600 border-green-200"
                              onClick={() => updateOrder.mutate({ id: order.id, status: "collected" })}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />Collected
                            </Button>
                          )}
                          {(order.status === "pending" || order.status === "confirmed") && (
                            <Button size="sm" variant="ghost" className="text-red-500"
                              onClick={() => updateOrder.mutate({ id: order.id, status: "cancelled" })}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── BALANCES TAB ── */}
          <TabsContent value="balances" className="mt-4">
            {accounts.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-gray-400">No student tuckshop accounts yet</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {accounts.map(acc => (
                  <Card key={acc.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{acc.student_name ?? "Unknown Student"}</p>
                        <p className="text-sm text-gray-500">Balance: <span className={`font-bold ${acc.balance_cents < 500 ? "text-red-600" : "text-green-600"}`}>R {acc.balance_display}</span></p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedAccount(acc); setTopupDialog(true); }}>
                        <DollarSign className="h-3.5 w-3.5 mr-1" />Top Up
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Menu Edit Dialog ── */}
      <Dialog open={menuDialog} onOpenChange={setMenuDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMenu ? "Edit Menu" : "Publish New Menu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Week Label</Label>
              <Input
                placeholder="e.g. Week of 2 June 2026"
                value={weekLabel}
                onChange={e => setWeekLabel(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Menu Items</Label>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
              </div>
              <div className="space-y-3">
                {menuItems.map(item => (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} placeholder="e.g. Cheese Burger" className="mt-0.5 h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Price (R)</Label>
                        <Input type="number" step="0.01" value={(item.price / 100).toFixed(2)} onChange={e => updateItem(item.id, "price", Math.round(parseFloat(e.target.value || "0") * 100))} className="mt-0.5 h-8 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Category</Label>
                        <Select value={item.category} onValueChange={v => updateItem(item.id, "category", v)}>
                          <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} placeholder="Optional" className="mt-0.5 h-8 text-sm" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={item.available} onChange={e => updateItem(item.id, "available", e.target.checked)} />
                        Available
                      </label>
                      <Button size="sm" variant="ghost" className="text-red-500 h-7" onClick={() => removeItem(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setMenuDialog(false)}>Cancel</Button>
            <Button onClick={saveMenu} disabled={!weekLabel.trim() || publishMenu.isPending || updateMenu.isPending}>
              {editMenu ? "Save Changes" : "Publish Menu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Top Up Dialog ── */}
      <Dialog open={topupDialog} onOpenChange={setTopupDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Top Up Account</DialogTitle>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedAccount.student_name}</p>
                <p className="text-sm text-gray-500">Current balance: <span className="font-bold text-green-600">R {selectedAccount.balance_display}</span></p>
              </div>
              <div>
                <Label>Amount (R)</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input placeholder="e.g. Cash received at front desk" value={topupNote} onChange={e => setTopupNote(e.target.value)} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopupDialog(false)}>Cancel</Button>
            <Button onClick={doTopup} disabled={!topupAmount || topupMutation.isPending}>
              Add Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
