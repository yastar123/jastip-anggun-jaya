import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const SERVICES = [
  {
    key: "jastip hemat",
    title: "Jastip Hemat",
    desc: "Pilihan hemat untuk paket kecil & sedang.",
  },
  {
    key: "jastip pesawat",
    title: "Jastip Pesawat",
    desc: "Pengiriman tercepat melalui pesawat.",
  },
  {
    key: "jastip kargo",
    title: "Jastip Kargo",
    desc: "Ekonomis untuk paket besar atau berat.",
  },
  {
    key: "jastip pelni",
    title: "Jastip Pelni",
    desc: "Pilihan kapal untuk pengiriman laut.",
  },
];

export default function AdminPackagesType() {
  const [selected, setSelected] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  function chooseService(key: string) {
    setSelected(key);
  }

  function chooseMode(mode: "single" | "combined") {
    if (!selected) return;
    const q = new URLSearchParams({ serviceType: selected, packageMode: mode });
    setLocation(`/admin/packages/new?${q.toString()}`);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setLocation("/admin/packages")}
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
        {SERVICES.map((s) => (
          <Card
            key={s.key}
            className={`cursor-pointer hover:shadow-md transition-shadow ${selected === s.key ? "ring-2 ring-primary" : ""}`}
            onClick={() => chooseService(s.key)}
          >
            <CardHeader>
              <CardTitle className="text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              {selected === s.key && (
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => chooseMode("single")}>
                    Jastip 1 Barang
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => chooseMode("combined")}
                  >
                    Jastip Gabungan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
