import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plane, Ship, Package, Truck } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const SERVICES = [
  {
    key: "jastip hemat",
    title: "Jastip Hemat",
    desc: "Surabaya → Manokwari. Tarif Rp 10.000/kg. Pilihan hemat untuk paket kecil & sedang.",
    icon: Package,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    key: "jastip pesawat",
    title: "Jastip Pesawat",
    desc: "Jakarta → Manokwari. Tarif Rp 77.000/kg. Pengiriman tercepat melalui pesawat.",
    icon: Plane,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "jastip kargo",
    title: "Jastip Kargo",
    desc: "Jakarta/Surabaya → Manokwari. Tarif Rp 7.000/kg. Ekonomis untuk paket besar.",
    icon: Truck,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    key: "jastip pelni",
    title: "Jastip Pelni",
    desc: "Jakarta/Surabaya → Manokwari. Tarif berjenjang per berat. Pengiriman kapal laut.",
    icon: Ship,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setLocation(`${base}/packages`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Pilih Jenis Jastip
          </h1>
          <p className="text-muted-foreground mt-1">
            Pilih jenis layanan sebelum mengisi data paket.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SERVICES.map((s) => {
          const Icon = s.icon;
          const isSelected = selected === s.key;
          return (
            <Card
              key={s.key}
              className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"}`}
              onClick={() => setSelected(s.key)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
                {isSelected && (
                  <div className="mt-4 flex gap-2">
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
