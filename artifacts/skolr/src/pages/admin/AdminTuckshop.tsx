import React, { useState, useEffect } from "react";
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
  ShoppingBag, Plus, Trash2, Edit2, ClipboardList,
  CheckCircle, Package, Users, ExternalLink, Settings, Loader2,
} from "lucide-react";

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
  const { profile, school, user, session } = useAuth();
  const qc = useQueryClient();
  const schoolId = school?.id ?? profile?.school_id ?? "";

  const [activeTab, setActiveTab] = useState("menu");
  const [menuDialog, setMenuDialog] = useState(false);
  const [editMenu, setEditMenu] = useState<Menu | null>(null);
  const [weekLabel, setWeekLabel] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tuckshopUrlInput, setTuckshopUrlInput] = useState("");
  const [canteenEmailInput, setCanteenEmailInput] = useState("");
  const [urlSaving, setUrlSaving] = useState(false);

  useEffect(() => {
    if (school?.tuckshopUrl) setTuckshopUrlInput(school.tuckshopUrl);
    if (school?.canteenEmail) setCanteenEmailInput(school.canteenEmail);
  }, [school]);

  const { data: menus = [] } = useQuery<Menu[]>({
    queryKey: ["tuckshop-menus", schoolId],
    queryFn: () => apiFetch(`/api/tuckshop/menus?school_id=${schoolId}`, session?.access_token ?? ""),
    enabled: !!schoolId,
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["tuckshop-orders-admin", schoolId],
    queryFn: () => apiFetch(`/api/tuckshop/orders?school_id=${schoolId}`, session?.access_token ?? ""),
    enabled: !!schoolId,
  });

  const publishMenu = useMutation({
    mutationFn: (body: unknown) => apiFetch("/api/tuckshop/menu", session?.access_token ?? "", { method: "POST", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tuckshop-menus"] }); setMenuDialog(false); },
  });

  const updateMenu = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      apiFetch(`/api/tuckshop/menu/${id}`, session?.access_token ?? "", { method: "PATCH", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tuckshop-menus"] }); setMenuDialog(false); },
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/tuckshop/orders/${id}`, session?.access_token ?? "", { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tuckshop-orders-admin"] }),
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

  async function saveTuckshopUrl() {
    if (!schoolId || !session?.access_token) return;
    setUrlSaving(true);
    try {
      await apiFetch(`/api/schools/${schoolId}`, session.access_token, {
        method: "PATCH",
        body: {
          tuckshop_url: tuckshopUrlInput.trim() || null,
          canteen_email: canteenEmailInput.trim() || null,
        },
      });
      qc.invalidateQueries({ queryKey: ["school", schoolId] });
    } finally {
      setUrlSaving(false);
    }
  }

  const pendingOrders = orders.filter(o => o.status === "pending");

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tuckshop</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage the weekly menu and top-up settings</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="menu">Weekly Menu</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
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

          {/* ── SETTINGS TAB ── */}
          <TabsContent value="settings" className="mt-4">
            <div className="max-w-lg space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4" /> Tuckshop App Link
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Enter the URL of your school's tuckshop application. Parents and students will see a button to open it directly.
                  </p>
                  <div className="space-y-2">
                    <Label>Tuckshop App URL</Label>
                    <Input
                      type="url"
                      placeholder="https://tuckshop.yourschool.co.za"
                      value={tuckshopUrlInput}
                      onChange={e => setTuckshopUrlInput(e.target.value)}
                    />
                  </div>
                  {tuckshopUrlInput && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-3">
                      <ExternalLink className="h-4 w-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Preview link</p>
                        <a
                          href={tuckshopUrlInput}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate block"
                        >
                          {tuckshopUrlInput}
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <Label htmlFor="canteen-email">Canteen notification email</Label>
                    <p className="text-xs text-gray-500 mb-1.5">
                      New canteen orders are emailed here with the student's name, grade, class and items. Leave blank to disable.
                    </p>
                    <Input
                      id="canteen-email"
                      type="email"
                      placeholder="canteen@yourschool.co.za"
                      value={canteenEmailInput}
                      onChange={e => setCanteenEmailInput(e.target.value)}
                    />
                  </div>
                  <Button onClick={saveTuckshopUrl} disabled={urlSaving} className="bg-blue-600 hover:bg-blue-700">
                    {urlSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Settings
                  </Button>
                  {school?.tuckshopUrl && (
                    <p className="text-xs text-gray-400">
                      Current saved URL: <span className="font-mono">{school.tuckshopUrl}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
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

    </PortalLayout>
  );
}
