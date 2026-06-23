import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plane, Ship, Package, Truck } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const SERVICES = [
  {
    key: "jastip hemat+",
    title: "Jastip Hemat+",
    route: "Surabaya → Manokwari",
    icon: Package,
    color: "text-green-600",
    bg: "bg-green-50",
    ringColor: "ring-green-500",
    headerBg: "bg-green-50",
    rateType: "per-kg" as const,
    ratePerKg: 10000,
    rateNote: "Tarif Rp 10.000/kg",
    rates: [
      { label: "1 kg", value: 10000 },
      { label: "2 kg", value: 20000 },
      { label: "5 kg", value: 50000 },
      { label: "10 kg", value: 100000 },
    ],
  },
  {
    key: "jastip pesawat",
    title: "Jastip Pesawat",
    route: "Jakarta → Manokwari",
    icon: Plane,
    color: "text-blue-600",
    bg: "bg-blue-50",
    ringColor: "ring-blue-500",
    headerBg: "bg-blue-50",
    rateType: "bracket" as const,
    rateNote: "Tarif berdasarkan berat paket",
    rates: [
      { label: "1 – 200 gram", value: 15800 },
      { label: "201 – 400 gram", value: 30800 },
      { label: "401 – 500 gram", value: 38500 },
      { label: "600 gram", value: 46200 },
      { label: "700 gram", value: 53900 },
      { label: "800 gram", value: 61600 },
      { label: "900 gram", value: 69300 },
      { label: "1 kg", value: 77000 },
      { label: "2 kg", value: 154000 },
      { label: "3 kg", value: 231000 },
      { label: "5 kg", value: 385000 },
      { label: "10 kg", value: 770000 },
    ],
  },
  {
    key: "jastip kargo",
    title: "Jastip Kargo",
    route: "Jakarta/Surabaya → Manokwari",
    icon: Truck,
    color: "text-orange-600",
    bg: "bg-orange-50",
    ringColor: "ring-orange-500",
    headerBg: "bg-orange-50",
    rateType: "per-kg" as const,
    ratePerKg: 7000,
    rateNote: "Tarif Rp 7.000/kg",
    rates: [
      { label: "10 kg", value: 70000 },
      { label: "20 kg", value: 140000 },
      { label: "50 kg", value: 350000 },
      { label: "100 kg", value: 700000 },
    ],
  },
  {
    key: "jastip pelni",
    title: "Jastip Pelni",
    route: "Jakarta / Surabaya → Manokwari",
    icon: Ship,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    ringColor: "ring-cyan-500",
    headerBg: "bg-cyan-50",
    rateType: "tiered" as const,
    rateNote: "Tarif berjenjang per kg",
    tieredRoutes: [
      {
        route: "Jakarta → Manokwari",
        tiers: [
          { label: "1 – 10 kg", ratePerKg: 20000, example: "5 kg = Rp 100.000" },
          { label: "11 – 20 kg", ratePerKg: 19000, example: "15 kg = Rp 285.000" },
          { label: "21 – 40 kg", ratePerKg: 18000, example: "30 kg = Rp 540.000" },
          { label: "41 – 80 kg", ratePerKg: 17000, example: "50 kg = Rp 850.000" },
        ],
      },
      {
        route: "Surabaya → Manokwari",
        tiers: [
          { label: "1 – 10 kg", ratePerKg: 18000, example: "5 kg = Rp 90.000" },
          { label: "11 – 20 kg", ratePerKg: 17000, example: "15 kg = Rp 255.000" },
          { label: "21 – 40 kg", ratePerKg: 16000, example: "30 kg = Rp 480.000" },
          { label: "41 – 80 kg", ratePerKg: 15500, example: "50 kg = Rp 775.000" },
        ],
      },
    ],
    rates: [],
  },
];

export default function AdminPackagesType() {
  const [selected, setSelected] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  function chooseMode(mode: "single" | "grup") {
    if (!selected) return;
    const q = new URLSearchParams({ serviceType: selected, packageMode: mode });
    setLocation(`${base}/packages/new?${q.toString()}`);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setLocation(`${base}/packages`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pilih Jenis Jastip</h1>
          <p className="text-muted-foreground mt-1">
            Pilih jenis layanan dan lihat tarif ongkir sebelum mengisi data paket.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {SERVICES.map((s) => {
          const Icon = s.icon;
          const isSelected = selected === s.key;
          return (
            <Card
              key={s.key}
              className={`cursor-pointer transition-all border-2 ${
                isSelected
                  ? `ring-2 ${s.ringColor} shadow-lg border-transparent`
                  : "hover:shadow-md border-border"
              }`}
              onClick={() => setSelected(s.key)}
            >
              {/* Header */}
              <CardHeader className={`pb-2 rounded-t-xl ${isSelected ? s.headerBg : ""}`}>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shadow-sm`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="font-bold">{s.title}</p>
                    <p className="text-xs font-normal text-muted-foreground">{s.route}</p>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-2 pb-3 space-y-3">
                {/* Rate label */}
                <p className={`text-xs font-semibold ${s.color} uppercase tracking-wide`}>{s.rateNote}</p>

                {/* Rate table */}
                {s.rateType === "bracket" && (
                  <div className="border rounded-lg overflow-hidden text-xs">
                    <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 font-semibold text-muted-foreground">
                      <span>Berat Paket</span>
                      <span className="text-right">Ongkir</span>
                    </div>
                    <div className="divide-y max-h-52 overflow-y-auto">
                      {s.rates.map((r, i) => (
                        <div key={i} className="grid grid-cols-2 px-3 py-1.5 hover:bg-muted/30">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="text-right font-semibold">{formatRp(r.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {s.rateType === "per-kg" && (
                  <div className="border rounded-lg overflow-hidden text-xs">
                    <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 font-semibold text-muted-foreground">
                      <span>Berat Paket</span>
                      <span className="text-right">Ongkir</span>
                    </div>
                    <div className="divide-y">
                      {s.rates.map((r, i) => (
                        <div key={i} className="grid grid-cols-2 px-3 py-1.5 hover:bg-muted/30">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="text-right font-semibold">{formatRp(r.value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-1.5 bg-muted/30 text-muted-foreground italic">
                      *Berat lainnya dihitung otomatis
                    </div>
                  </div>
                )}

                {s.rateType === "tiered" && s.tieredRoutes && (
                  <div className="space-y-2">
                    {s.tieredRoutes.map((tr) => (
                      <div key={tr.route} className="border rounded-lg overflow-hidden text-xs">
                        <div className="bg-muted/60 px-3 py-1.5 font-semibold text-muted-foreground">
                          {tr.route}
                        </div>
                        <div className="grid grid-cols-3 px-3 py-1 font-semibold text-muted-foreground bg-muted/30 border-b">
                          <span>Berat</span>
                          <span className="text-center">Tarif/kg</span>
                          <span className="text-right">Contoh</span>
                        </div>
                        <div className="divide-y">
                          {tr.tiers.map((tier, i) => (
                            <div key={i} className="grid grid-cols-3 px-3 py-1.5 hover:bg-muted/30">
                              <span className="text-muted-foreground">{tier.label}</span>
                              <span className="text-center font-semibold">{formatRp(tier.ratePerKg)}</span>
                              <span className="text-right text-muted-foreground">{tier.example}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mode buttons when selected */}
                {isSelected && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); chooseMode("single"); }}
                    >
                      1 Paket
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); chooseMode("grup"); }}
                    >
                      Grup Paket
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
