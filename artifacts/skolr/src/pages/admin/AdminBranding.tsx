import React, { useState, useRef, useEffect } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Palette, Upload, Check, Loader2, Eye, RotateCcw,
  Building2, Home, Users, BookOpen, Calendar, FileText, X,
} from 'lucide-react';

const PRESET_COLORS = [
  { label: 'Blue',    value: '#2563EB' },
  { label: 'Indigo',  value: '#4338CA' },
  { label: 'Violet',  value: '#7C3AED' },
  { label: 'Purple',  value: '#9333EA' },
  { label: 'Rose',    value: '#E11D48' },
  { label: 'Orange',  value: '#EA580C' },
  { label: 'Amber',   value: '#D97706' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Green',   value: '#16A34A' },
  { label: 'Teal',    value: '#0D9488' },
  { label: 'Sky',     value: '#0284C7' },
  { label: 'Slate',   value: '#475569' },
];

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Resize + compress image to max 256×256 px, returned as PNG data URL */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 256;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image')); };
    img.src = objectUrl;
  });
}

function SidebarPreview({ color, logoUrl, schoolName }: { color: string; logoUrl: string; schoolName: string }) {
  const previewLinks = [
    { name: 'Dashboard', Icon: Home },
    { name: 'Users',     Icon: Users },
    { name: 'Classes',   Icon: BookOpen },
    { name: 'Calendar',  Icon: Calendar },
    { name: 'Reports',   Icon: FileText },
  ];
  return (
    <div className="flex h-72 w-52 rounded-xl overflow-hidden shadow-lg border border-gray-200">
      <div className="w-full bg-white flex flex-col">
        <div className="h-12 flex items-center px-3 border-b border-gray-100 gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-7 w-7 object-contain rounded flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: color }}>
              {schoolName?.[0]?.toUpperCase() ?? 'S'}
            </div>
          )}
          <span className="font-bold text-sm truncate" style={{ color }}>
            {schoolName || 'Your School'}
          </span>
        </div>
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {previewLinks.map((link, i) => {
            const active = i === 0;
            return (
              <div
                key={link.name}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium"
                style={active ? { backgroundColor: hexToRgba(color, 0.12), color } : { color: '#4B5563' }}
              >
                <link.Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {link.name}
              </div>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: color }}>
              A
            </div>
            <div>
              <p className="text-xs font-medium text-gray-800 leading-none">Admin</p>
              <p className="text-[10px] text-gray-400">admin@school.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBranding() {
  const { user, school, schoolId, refreshSchool } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [primaryColor, setPrimaryColor] = useState(school?.primaryColor ?? '#2563EB');
  const [logoUrl, setLogoUrl] = useState(school?.logoUrl ?? '');
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [schoolName, setSchoolName] = useState(school?.name ?? '');
  const [logoTab, setLogoTab] = useState<'upload' | 'url'>('upload');
  const [logoFileName, setLogoFileName] = useState('');
  const [logoPreview, setLogoPreview] = useState(school?.logoUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (school) {
      setPrimaryColor(school.primaryColor ?? '#2563EB');
      setLogoUrl(school.logoUrl ?? '');
      setLogoPreview(school.logoUrl ?? '');
      setSchoolName(school.name ?? '');
    }
  }, [school]);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please use an image under 5 MB.', variant: 'destructive' });
      return;
    }
    setUploadingLogo(true);
    try {
      const compressed = await compressImage(file);
      setLogoPreview(compressed);
      setLogoUrl(compressed);
      setLogoFileName(file.name);
    } catch {
      toast({ title: 'Could not read image', description: 'Please try a different file.', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please refresh and try again.', variant: 'destructive' });
      return;
    }
    if (!schoolId) {
      toast({ title: 'No school found', description: 'Your account is not linked to a school.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const effectiveLogoUrl = logoTab === 'url' ? logoUrlInput : logoUrl;
      const body: Record<string, string> = {
        primary_color: primaryColor,
        logo_url: effectiveLogoUrl,
      };
      if (schoolName.trim()) body.name = schoolName.trim();

      const res = await fetch(`/api/schools/${schoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error ${res.status}: ${errText}`);
      }

      await refreshSchool();
      toast({ title: 'Branding saved!', description: 'All users at your school will see the updated colours and logo.' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPrimaryColor('#2563EB');
    setLogoUrl('');
    setLogoPreview('');
    setLogoFileName('');
    setLogoUrlInput('');
  };

  const clearLogo = () => {
    setLogoUrl('');
    setLogoPreview('');
    setLogoFileName('');
    setLogoUrlInput('');
  };

  return (
    <PortalLayout role="admin">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="h-6 w-6 text-blue-600" /> School Branding
          </h1>
          <p className="text-gray-500 mt-1">
            Customise your school's colours and logo — all users at your school will see these changes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: settings */}
          <div className="lg:col-span-2 space-y-5">

            {/* School name */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" /> School Name
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  placeholder="Springfield Academy"
                />
              </CardContent>
            </Card>

            {/* Primary colour */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-blue-500" /> Brand Colour
                </CardTitle>
                <CardDescription>Used for the sidebar accent, active nav items, and user avatars.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.value}
                      title={c.label}
                      className="relative h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style={{
                        backgroundColor: c.value,
                        borderColor: primaryColor === c.value ? 'white' : 'transparent',
                        boxShadow: primaryColor === c.value ? `0 0 0 2px ${c.value}` : undefined,
                      }}
                      onClick={() => setPrimaryColor(c.value)}
                    >
                      {primaryColor === c.value && (
                        <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                    title="Custom colour"
                  />
                  <Input
                    value={primaryColor}
                    onChange={e => {
                      const v = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setPrimaryColor(v);
                    }}
                    placeholder="#2563EB"
                    className="font-mono w-32"
                  />
                  <span className="text-sm text-gray-500">Custom hex code</span>
                </div>
              </CardContent>
            </Card>

            {/* Logo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4 text-blue-500" /> School Logo
                </CardTitle>
                <CardDescription>
                  Shown in the sidebar for all users. Recommended: square PNG with transparent background.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Tab switcher */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={logoTab === 'upload' ? 'default' : 'outline'}
                    size="sm"
                    className={logoTab === 'upload' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    onClick={() => { setLogoTab('upload'); openFilePicker(); }}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload file
                  </Button>
                  <Button
                    type="button"
                    variant={logoTab === 'url' ? 'default' : 'outline'}
                    size="sm"
                    className={logoTab === 'url' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    onClick={() => setLogoTab('url')}
                  >
                    Paste URL
                  </Button>
                </div>

                {/* Hidden file input — always mounted so ref works */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {logoTab === 'upload' && (
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={openFilePicker}
                  >
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Processing image…</p>
                      </>
                    ) : logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo preview" className="h-16 w-16 object-contain mx-auto mb-2 rounded" />
                        <p className="text-sm text-gray-600 truncate max-w-xs mx-auto">{logoFileName || 'Uploaded logo'}</p>
                        <p className="text-xs text-blue-500 mt-1">Click to replace</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-700">Click to choose a file</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG or WebP · max 5 MB</p>
                      </>
                    )}
                  </div>
                )}

                {logoTab === 'url' && (
                  <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input
                      placeholder="https://example.com/logo.png"
                      value={logoUrlInput}
                      onChange={e => {
                        setLogoUrlInput(e.target.value);
                        setLogoPreview(e.target.value);
                      }}
                    />
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-14 w-14 object-contain rounded border mt-2"
                        onError={() => setLogoPreview('')}
                      />
                    )}
                  </div>
                )}

                {(logoUrl || logoUrlInput) && (
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500 gap-1.5" onClick={clearLogo}>
                    <X className="h-3.5 w-3.5" /> Remove logo
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: live preview */}
          <div>
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-500" /> Live Preview
                </CardTitle>
                <CardDescription>How your sidebar will look.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <SidebarPreview
                  color={/^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : '#2563EB'}
                  logoUrl={logoPreview}
                  schoolName={schoolName}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 min-w-[140px]">
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</>
              : <><Check className="h-4 w-4 mr-2" /> Save branding</>
            }
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reset to defaults
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}
