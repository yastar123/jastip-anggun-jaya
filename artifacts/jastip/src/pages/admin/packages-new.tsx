import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreatePackage,
  getListPackagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calculator, CalendarDays, CheckCircle2, Plus, Users, QrCode, ArrowRight, Layers, Truck, Box } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

const packageSchema = z.object({
  packageDate: z.string().optional().nullable(),
  customerId: z.coerce.number().optional().nullable(),
  customerName: z.string().optional().nullable(),
  itemName: z.string().optional().nullable(),
  resiNumber: z.string().min(1, "No Resi wajib diisi"),
  packageNumber: z.string().optional().nullable(),
  serviceType: z.string().optional().nullable(),
  packageMode: z.string().optional().nullable(),
  deliveryRoute: z.string().optional().nullable(),
  realWeight: z.coerce.number().optional().nullable(),
  length: z.coerce.number().optional().nullable(),
  width: z.coerce.number().optional().nullable(),
  height: z.coerce.number().optional().nullable(),
  volumeWeight: z.coerce.number().optional().nullable(),
  usedWeight: z.coerce.number().optional().nullable(),
  shippingRate: z.coerce.number().optional().nullable(),
  totalWeight: z.coerce.number().optional().nullable(),
  totalShipping: z.coerce.number().optional().nullable(),
  price: z.coerce.number().optional().nullable(),
  packagingType: z.string().optional().nullable(),
});

type PackageFormValues = z.infer<typeof packageSchema>;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

const volumeDivisor: Record<string, number> = {
  "jastip pesawat": 5000,
  "jastip hemat+": 4000,
  "jastip pelni": 4000,
  "jastip kargo": 1000000,
};

const deliveryRouteOptions: Record<string, { value: string; label: string }[]> = {
  "jastip pesawat": [{ value: "Jakarta → Manokwari", label: "Jakarta → Manokwari" }],
  "jastip hemat+": [{ value: "Surabaya → Manokwari", label: "Surabaya → Manokwari" }],
  "jastip kargo": [{ value: "Jakarta/Surabaya → Manokwari", label: "Jakarta/Surabaya → Manokwari" }],
  "jastip pelni": [
    { value: "Jakarta → Manokwari", label: "Jakarta → Manokwari" },
    { value: "Surabaya → Manokwari", label: "Surabaya → Manokwari" },
  ],
};

function getShippingRate(
  serviceType: string | null | undefined,
  deliveryRoute: string | null | undefined,
  weight: number | null | undefined,
): number | null {
  if (!serviceType || !weight || weight <= 0) return null;
  if (serviceType === "jastip pesawat") return 77000;
  if (serviceType === "jastip hemat+") return 10000;
  if (serviceType === "jastip kargo") return 7000;
  if (serviceType === "jastip pelni") {
    if (deliveryRoute === "Jakarta → Manokwari") {
      if (weight <= 10) return 20000;
      if (weight <= 20) return 19000;
      if (weight <= 40) return 18000;
      return 17000;
    }
    if (deliveryRoute === "Surabaya → Manokwari") {
      if (weight <= 10) return 18000;
      if (weight <= 20) return 17000;
      if (weight <= 40) return 16000;
      return 15500;
    }
  }
  return null;
}

function getTotalShipping(
  serviceType: string | null | undefined,
  deliveryRoute: string | null | undefined,
  weight: number | null | undefined,
): number | null {
  if (!serviceType || !deliveryRoute || !weight || weight <= 0) return null;
  if (serviceType === "jastip pesawat" && deliveryRoute === "Jakarta → Manokwari") {
    if (weight <= 0.2) return 15800;
    if (weight <= 0.4) return 30800;
    if (weight <= 0.5) return 38500;
    if (weight <= 0.6) return 46200;
    if (weight <= 0.7) return 53900;
    if (weight <= 0.8) return 61600;
    if (weight <= 0.9) return 69300;
    if (weight <= 1) return 77000;
    if (weight <= 2) return 154000;
    if (weight <= 3) return 231000;
    if (weight <= 5) return 385000;
    if (weight <= 10) return 770000;
    return Math.round(weight * 77000);
  }
  if (serviceType === "jastip hemat+" && deliveryRoute === "Surabaya → Manokwari") {
    return Math.round(weight * 10000);
  }
  if (serviceType === "jastip kargo" && deliveryRoute === "Jakarta/Surabaya → Manokwari") {
    return Math.round(weight * 7000);
  }
  if (serviceType === "jastip pelni") {
    if (deliveryRoute === "Jakarta → Manokwari") {
      if (weight <= 10) return Math.round(weight * 20000);
      if (weight <= 20) return Math.round(weight * 19000);
      if (weight <= 40) return Math.round(weight * 18000);
      return Math.round(weight * 17000);
    }
    if (deliveryRoute === "Surabaya → Manokwari") {
      if (weight <= 10) return Math.round(weight * 18000);
      if (weight <= 20) return Math.round(weight * 17000);
      if (weight <= 40) return Math.round(weight * 16000);
      return Math.round(weight * 15500);
    }
  }
  return null;
}

function formatRp(n: number | null | undefined) {
  if (n == null) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function parseQueryParams() {
  try {
    const q = new URLSearchParams(window.location.search);
    return {
      serviceType: q.get("serviceType") || undefined,
      packageMode: q.get("packageMode") || undefined,
      customerName: q.get("customerName") || undefined,
      packageDate: q.get("packageDate") || undefined,
    };
  } catch {
    return {};
  }
}

type GrupPhase = "inputting" | "naming" | "batch_done";

interface CompletedBatch {
  customerName: string;
  ids: number[];
  count: number;
  weight: number;
}

async function patchPackageCustomerName(id: number, customerName: string) {
  const token = localStorage.getItem("jaj_token");
  const r = await fetch(`/api/packages/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ customerName }),
  });
  if (!r.ok) throw new Error("Gagal memperbarui nama konsumen");
}

export default function AdminPackagesNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  const createPackage = useCreatePackage();
  const params = parseQueryParams();
  const packageMode = params.packageMode;
  const isGrup = packageMode === "grup";

  // Single-mode group state (legacy)
  const [savedGrup, setSavedGrup] = useState<{
    customerName: string;
    serviceType: string;
    packageDate: string;
    deliveryRoute: string;
  } | null>(null);
  const [singleGrupIds, setSingleGrupIds] = useState<number[]>([]);
  const [singleGrupTotalWeight, setSingleGrupTotalWeight] = useState(0);
  const [singleGrupCount, setSingleGrupCount] = useState(0);

  // Multi-name grup state
  const [grupPhase, setGrupPhase] = useState<GrupPhase>("inputting");
  const [completedBatches, setCompletedBatches] = useState<CompletedBatch[]>([]);
  const [currentBatchIds, setCurrentBatchIds] = useState<number[]>([]);
  const [currentBatchCount, setCurrentBatchCount] = useState(0);
  const [currentBatchWeight, setCurrentBatchWeight] = useState(0);
  const [currentBatchName, setCurrentBatchName] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [isAssigningName, setIsAssigningName] = useState(false);

  const allGrupIds = [
    ...completedBatches.flatMap((b) => b.ids),
    ...currentBatchIds,
  ];
  const totalGrupPackages = completedBatches.reduce((s, b) => s + b.count, 0) + currentBatchCount;

  const defaultRoute = params.serviceType
    ? (deliveryRouteOptions[params.serviceType]?.[0]?.value ?? undefined)
    : undefined;

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      packageDate: params.packageDate || todayStr(),
      resiNumber: "",
      packageNumber: "",
      itemName: "",
      customerName: isGrup ? "" : (params.customerName || ""),
      serviceType: params.serviceType,
      packageMode: packageMode,
      deliveryRoute: defaultRoute,
    },
  });

  const serviceType = form.watch("serviceType");
  const deliveryRoute = form.watch("deliveryRoute");
  const length = form.watch("length");
  const width = form.watch("width");
  const height = form.watch("height");
  const realWeight = form.watch("realWeight");

  const isKargo = serviceType === "jastip kargo";
  const isPelni = serviceType === "jastip pelni";

  useEffect(() => {
    if (!serviceType) {
      form.setValue("deliveryRoute", "" as any, { shouldDirty: true });
      return;
    }
    const options = deliveryRouteOptions[serviceType] ?? [];
    if (options.length === 0) {
      form.setValue("deliveryRoute", "" as any, { shouldDirty: true });
      return;
    }
    const currentRoute = form.getValues("deliveryRoute");
    const selectedRoute = options.find((o) => o.value === currentRoute);
    if (!selectedRoute) {
      form.setValue("deliveryRoute", options[0].value, { shouldDirty: true });
    }
  }, [serviceType]);

  useEffect(() => {
    const currentRoute = form.getValues("deliveryRoute");
    const divisor = serviceType ? volumeDivisor[serviceType] : undefined;
    const isKargoMode = serviceType === "jastip kargo";

    if (isKargoMode) {
      // For kargo: only auto-set M3 when all 3 dimensions are provided
      if (divisor && length && width && height && length > 0 && width > 0 && height > 0) {
        const vw = Number(((length * width * height) / divisor).toFixed(3));
        form.setValue("volumeWeight", vw, { shouldDirty: true });
      }
      // usedWeight = MAX(volumeWeight, realWeight) — recalculated in separate effect
      // shippingRate and totalShipping = manually entered / separate effect
    } else {
      let vw: number | null = null;
      if (divisor && length && width && height && length > 0 && width > 0 && height > 0) {
        vw = Number(((length * width * height) / divisor).toFixed(3));
      }
      form.setValue("volumeWeight", vw, { shouldDirty: true });

      const real = realWeight ?? 0;
      const volume = vw ?? 0;
      const uw = Math.max(real, volume);
      form.setValue("usedWeight", uw > 0 ? uw : null, { shouldDirty: true });

      const effectiveRoute = currentRoute || deliveryRoute;
      const rate = uw > 0 ? getShippingRate(serviceType, effectiveRoute, uw) : null;
      const total = uw > 0 ? getTotalShipping(serviceType, effectiveRoute, uw) : null;
      form.setValue("shippingRate", rate ?? null, { shouldDirty: true });
      form.setValue("totalShipping", total ?? null, { shouldDirty: true });
    }
  }, [serviceType, deliveryRoute, realWeight, length, width, height]);

  // Kargo: recalculate usedWeight when volumeWeight or realWeight changes
  useEffect(() => {
    if (serviceType !== "jastip kargo") return;
    const vw = watchedVolumeWeight ?? 0;
    const real = realWeight ?? 0;
    const uw = Math.max(vw, real);
    form.setValue("usedWeight", uw > 0 ? uw : null, { shouldDirty: true });
  }, [serviceType, watchedVolumeWeight, realWeight]);

  // Kargo: recalculate totalShipping when usedWeight or shippingRate changes
  useEffect(() => {
    if (serviceType !== "jastip kargo") return;
    const uw = watchedUsedWeight ?? 0;
    const rate = watchedShippingRateInput ?? 0;
    const total = uw > 0 && rate > 0 ? Math.round(uw * rate) : null;
    form.setValue("totalShipping", total ?? null, { shouldDirty: true });
  }, [serviceType, watchedUsedWeight, watchedShippingRateInput]);

  async function onSubmit(values: PackageFormValues) {
    // Require customerName for all modes
    if (!values.customerName?.trim()) {
      form.setError("customerName", { message: "Nama pemilik paket wajib diisi" });
      return;
    }

    try {
      setIsSubmitting(true);

      if (!isGrup) {
        // --- SINGLE MODE ---
        const newTotalWeight = singleGrupTotalWeight + (values.realWeight ?? 0);
        const result = await createPackage.mutateAsync({
          data: {
            ...values,
            totalWeight: packageMode === "grup" ? newTotalWeight : (values.realWeight ?? undefined),
          } as any,
        });
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });

        if (packageMode === "grup") {
          const newId = (result as any)?.id;
          if (newId) setSingleGrupIds((prev) => [...prev, newId]);
          setSingleGrupTotalWeight(newTotalWeight);
          setSingleGrupCount((c) => c + 1);
          setSavedGrup({
            customerName: values.customerName || "",
            serviceType: values.serviceType || "",
            packageDate: values.packageDate || todayStr(),
            deliveryRoute: values.deliveryRoute || "",
          });
          form.reset({
            packageDate: values.packageDate || todayStr(),
            resiNumber: "",
            packageNumber: "",
            itemName: "",
            customerName: values.customerName,
            serviceType: values.serviceType,
            packageMode: "grup",
            deliveryRoute: values.deliveryRoute,
          });
          toast({ title: "Paket disimpan", description: "Silakan input paket berikutnya atau klik Selesai." });
        } else {
          toast({ title: "Berhasil", description: "Paket baru berhasil ditambahkan. Barcode siap dicetak." });
          const newId = (result as any)?.id;
          setLocation(`${base}/barcode${newId ? `?ids=${newId}` : ""}`);
        }
      } else {
        // --- GRUP MULTI-NAMA MODE ---
        const newWeight = currentBatchWeight + (values.realWeight ?? 0);
        const result = await createPackage.mutateAsync({
          data: {
            ...values,
            customerName: values.customerName || "",
            totalWeight: newWeight,
          } as any,
        });
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });

        const newId = (result as any)?.id;
        const newCount = currentBatchCount + 1;
        const newIds = newId ? [...currentBatchIds, newId] : currentBatchIds;

        setCurrentBatchIds(newIds);
        setCurrentBatchCount(newCount);
        setCurrentBatchWeight(newWeight);
        setCurrentBatchName(values.customerName?.trim() || "");

        form.reset({
          packageDate: values.packageDate || todayStr(),
          resiNumber: "",
          packageNumber: "",
          itemName: "",
          customerName: values.customerName || "",
          serviceType: values.serviceType,
          packageMode: "grup",
          deliveryRoute: values.deliveryRoute,
        });

        toast({
          title: `Paket ke-${newCount} tersimpan — ${values.customerName?.trim() || ""}`,
          description: "Lanjut input paket berikutnya, atau klik 'Selesaikan Batch, Ganti Nama' untuk pindah ke penerima lain.",
        });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.message || "Terjadi kesalahan" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignName() {
    if (!pendingName.trim()) {
      toast({ variant: "destructive", title: "Nama wajib diisi", description: "Masukkan nama penerima untuk paket-paket ini." });
      return;
    }
    if (currentBatchIds.length === 0) {
      toast({ variant: "destructive", title: "Belum ada paket", description: "Input minimal 1 paket sebelum memasukkan nama." });
      return;
    }
    setIsAssigningName(true);
    try {
      await Promise.all(currentBatchIds.map((id) => patchPackageCustomerName(id, pendingName.trim())));
      queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });

      const newBatch: CompletedBatch = {
        customerName: pendingName.trim(),
        ids: currentBatchIds,
        count: currentBatchCount,
        weight: currentBatchWeight,
      };
      setCompletedBatches((prev) => [...prev, newBatch]);
      setCurrentBatchIds([]);
      setCurrentBatchCount(0);
      setCurrentBatchWeight(0);
      setPendingName("");
      setGrupPhase("batch_done");
      toast({ title: `Nama "${pendingName.trim()}" berhasil disimpan`, description: `${currentBatchCount} paket telah ditugaskan.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal menyimpan nama", description: err.message });
    } finally {
      setIsAssigningName(false);
    }
  }

  function startNewBatch() {
    setGrupPhase("inputting");
    setPendingName("");
    form.reset({
      packageDate: form.getValues("packageDate") || todayStr(),
      resiNumber: "",
      packageNumber: "",
      itemName: "",
      customerName: "",
      serviceType: form.getValues("serviceType"),
      packageMode: "grup",
      deliveryRoute: form.getValues("deliveryRoute"),
    });
  }

  function finalizeBatch() {
    if (currentBatchIds.length === 0) return;
    const batchName = currentBatchName || form.getValues("customerName")?.trim() || "(Tanpa Nama)";
    const newBatch: CompletedBatch = {
      customerName: batchName,
      ids: currentBatchIds,
      count: currentBatchCount,
      weight: currentBatchWeight,
    };
    setCompletedBatches((prev) => [...prev, newBatch]);
    setCurrentBatchIds([]);
    setCurrentBatchCount(0);
    setCurrentBatchWeight(0);
    setCurrentBatchName("");
    setGrupPhase("batch_done");
    form.reset({
      packageDate: form.getValues("packageDate") || todayStr(),
      resiNumber: "",
      packageNumber: "",
      itemName: "",
      customerName: "",
      serviceType: form.getValues("serviceType"),
      packageMode: "grup",
      deliveryRoute: form.getValues("deliveryRoute"),
    });
    toast({ title: `Batch "${batchName}" selesai`, description: `${currentBatchCount} paket · Silakan input nama & paket berikutnya.` });
  }

  function goNextPackage() {
    if (!savedGrup) return;
    setSavedGrup(null);
    form.reset({
      packageDate: savedGrup.packageDate,
      resiNumber: "",
      packageNumber: "",
      itemName: "",
      customerName: savedGrup.customerName,
      serviceType: savedGrup.serviceType,
      packageMode: "grup",
      deliveryRoute: savedGrup.deliveryRoute,
    });
  }

  const serviceLabel: Record<string, string> = {
    "jastip pesawat": "Jastip Pesawat",
    "jastip hemat+": "Jastip Hemat+",
    "jastip kargo": "Jastip Kargo",
    "jastip pelni": "Jastip Pelni",
  };

  const watchedUsedWeight = form.watch("usedWeight");
  const watchedVolumeWeight = form.watch("volumeWeight");
  const watchedShippingRate = form.watch("shippingRate");
  const watchedTotalShipping = form.watch("totalShipping");
  const watchedShippingRateInput = watchedShippingRate;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setLocation(`${base}/packages/type`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Input Paket Baru</h1>
          <p className="text-muted-foreground mt-1">
            {serviceType ? (
              <>
                <span className="font-medium text-foreground">{serviceLabel[serviceType] || serviceType}</span>
                {isGrup ? " — Grup Paket (Multi Nama)" : packageMode === "grup" ? " — Grup Paket" : " — 1 Paket"}
              </>
            ) : (
              "Masukkan data lengkap paket yang diterima."
            )}
          </p>
        </div>
      </div>

      {/* ===== GRUP MULTI-NAMA MODE ===== */}
      {isGrup && (
        <div className="space-y-4">
          {/* Summary bar */}
          {(completedBatches.length > 0 || currentBatchCount > 0) && (
            <Card className="border-blue-300 bg-blue-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Layers className="h-5 w-5 text-blue-600 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-800">
                      Total: {allGrupIds.length} paket tersimpan
                    </p>
                    {completedBatches.map((b, i) => (
                      <span key={i} className="inline-flex items-center gap-1 mr-2 mt-1">
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                          ✓ {b.customerName} ({b.count} pkt)
                        </Badge>
                      </span>
                    ))}
                    {currentBatchCount > 0 && currentBatchName && (
                      <Badge variant="outline" className="text-xs text-blue-700 border-blue-400 bg-blue-100 ml-1 mt-1">
                        Sesi aktif: {currentBatchCount} pkt — {currentBatchName}
                      </Badge>
                    )}
                    {currentBatchCount > 0 && !currentBatchName && (
                      <Badge variant="outline" className="text-xs text-amber-700 border-amber-400 bg-amber-50 ml-1 mt-1">
                        Sesi aktif: {currentBatchCount} pkt (isi nama pemilik)
                      </Badge>
                    )}
                  </div>
                  {allGrupIds.length > 0 && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => setLocation(`${base}/barcode${allGrupIds.length > 0 ? `?ids=${allGrupIds.join(",")}` : ""}`)}
                    >
                      <QrCode className="h-4 w-4 mr-1" /> Generate {allGrupIds.length} Barcode Paket
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}


          {/* PHASE: batch_done — name assigned */}
          {grupPhase === "batch_done" && completedBatches.length > 0 && (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-green-800">
                      Nama "{completedBatches[completedBatches.length - 1]?.customerName}" berhasil disimpan!
                    </p>
                    <p className="text-sm text-green-700 mt-0.5">
                      {completedBatches[completedBatches.length - 1]?.count} paket · Total berat: {completedBatches[completedBatches.length - 1]?.weight.toFixed(3)} Kg
                    </p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button size="sm" variant="outline" className="gap-1 border-green-400 text-green-700 hover:bg-green-100" onClick={startNewBatch}>
                        <Plus className="h-3.5 w-3.5" /> Tambah Nama Baru
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 gap-1"
                        onClick={() => setLocation(`${base}/barcode${allGrupIds.length > 0 ? `?ids=${allGrupIds.join(",")}` : ""}`)}
                      >
                        <QrCode className="h-3.5 w-3.5" /> Generate Barcode
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Counter badge during inputting */}
          {grupPhase === "inputting" && (
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="text-sm px-3 py-1 bg-primary text-primary-foreground">
                Paket ke-{currentBatchCount + 1}
              </Badge>
              {currentBatchCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-green-500 text-green-700 hover:bg-green-50"
                  onClick={finalizeBatch}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Selesaikan Batch, Ganti Nama
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== SINGLE GRUP MODE (legacy - same customer name) ===== */}
      {!isGrup && packageMode === "grup" && singleGrupCount > 0 && !savedGrup && (
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold text-blue-800">Sesi Grup — {singleGrupCount} paket tersimpan</p>
                <p className="text-sm text-blue-700">Total berat sesi: <strong>{singleGrupTotalWeight.toFixed(3)} Kg</strong></p>
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setLocation(`${base}/barcode${singleGrupIds.length > 0 ? `?ids=${singleGrupIds.join(",")}` : ""}`)}
              >
                Selesai & Cetak Barcode
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isGrup && savedGrup && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-green-800">Paket berhasil disimpan!</p>
                <p className="text-sm text-green-700 mt-0.5">
                  Konsumen: <strong>{savedGrup.customerName}</strong> · {serviceLabel[savedGrup.serviceType] || savedGrup.serviceType}
                </p>
                <p className="text-sm text-green-700">{singleGrupCount} paket · Total berat: <strong>{singleGrupTotalWeight.toFixed(3)} Kg</strong></p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="gap-1 border-green-400" onClick={goNextPackage}>
                    <Plus className="h-3.5 w-3.5" /> Input Paket Berikutnya
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setLocation(`${base}/barcode${singleGrupIds.length > 0 ? `?ids=${singleGrupIds.join(",")}` : ""}`)}
                  >
                    Selesai &amp; Cetak Barcode
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== FORM ===== */}
      {(!isGrup || grupPhase === "inputting") && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section: Identitas Paket */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Identitas Paket
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="packageDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Nama Konsumen — tampil untuk semua mode */}
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Nama Pemilik Paket <span className="text-destructive">*</span>
                          {isGrup && (
                            <span className="text-xs font-normal text-muted-foreground ml-1">(nama penerima paket ini)</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Masukkan nama pemilik paket"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="resiNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No Resi <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Contoh: JNE123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="packageNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No Paket</FormLabel>
                        <FormControl>
                          <Input placeholder="Contoh: PKT-001" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Nama Barang — untuk Kargo dan Pelni */}
                {(isKargo || isPelni) && (
                  <FormField
                    control={form.control}
                    name="itemName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Nama Barang{" "}
                          <span className="text-xs text-muted-foreground">
                            {isKargo ? "(Khusus Kargo)" : "(Khusus Pelni)"}
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={isKargo ? "Contoh: Elektronik, Mesin, Material..." : "Contoh: Pakaian, Makanan, Perabot..."}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jenis Jastip</FormLabel>
                        {params.serviceType ? (
                          <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/40 text-sm font-medium">
                            {serviceLabel[field.value || ""] || field.value || params.serviceType}
                            <span className="ml-auto text-xs text-muted-foreground">Otomatis</span>
                          </div>
                        ) : (
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih jenis jastip" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="jastip pesawat">Jastip Pesawat</SelectItem>
                                <SelectItem value="jastip hemat+">Jastip Hemat+</SelectItem>
                                <SelectItem value="jastip kargo">Jastip Kargo</SelectItem>
                                <SelectItem value="jastip pelni">Jastip Pelni</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deliveryRoute"
                    render={({ field }) => {
                      const routeOpts = deliveryRouteOptions[serviceType || ""] || [];
                      const isSingleRoute = params.serviceType && routeOpts.length === 1;
                      return (
                        <FormItem>
                          <FormLabel>Lokasi Pengiriman</FormLabel>
                          {isSingleRoute ? (
                            <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/40 text-sm font-medium">
                              {field.value || routeOpts[0]?.label || "-"}
                              <span className="ml-auto text-xs text-muted-foreground">Otomatis</span>
                            </div>
                          ) : (
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={!serviceType}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={serviceType ? "Pilih lokasi pengiriman" : "Pilih jenis jastip dahulu"} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {routeOpts.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                          )}
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section: Berat & Dimensi */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Berat &amp; Dimensi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="realWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Berat Real (Kg)</FormLabel>
                        <FormControl>
                          <Input
                            type="number" step="0.001" placeholder="0.000"
                            {...field} value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { name: "length" as const, label: "Panjang (cm)" },
                    { name: "width" as const, label: "Lebar (cm)" },
                    { name: "height" as const, label: "Tinggi (cm)" },
                  ].map(({ name, label }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input
                              type="number" step="0.1" placeholder="0"
                              {...field} value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                {/* Auto-calculated summary */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Kalkulasi Otomatis</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Berat Volume (Kg)</p>
                      <p className="font-semibold">{watchedVolumeWeight != null ? watchedVolumeWeight.toFixed(3) : "-"}</p>
                      {serviceType && volumeDivisor[serviceType] && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          P × L × T ÷ {volumeDivisor[serviceType].toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Berat Digunakan (Kg)</p>
                      <p className="font-semibold text-primary">{watchedUsedWeight != null ? watchedUsedWeight.toFixed(3) : "-"}</p>
                      {watchedUsedWeight != null && realWeight != null && watchedVolumeWeight != null && (
                        <p className="text-xs text-muted-foreground">
                          MAX({realWeight.toFixed(3)}, {watchedVolumeWeight.toFixed(3)})
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tarif / Kg</p>
                      <p className="font-semibold">{formatRp(watchedShippingRate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Ongkir</p>
                      <p className="font-semibold text-primary">{formatRp(watchedTotalShipping)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting
                  ? "Menyimpan..."
                  : isGrup
                  ? `Simpan & Lanjut (Paket ke-${currentBatchCount + 1})`
                  : packageMode === "grup"
                  ? "Simpan & Lanjut"
                  : "Simpan Paket"}
              </Button>
              {!isGrup && packageMode === "grup" && singleGrupIds.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(`${base}/barcode${singleGrupIds.length > 0 ? `?ids=${singleGrupIds.join(",")}` : ""}`)}
                >
                  Selesai ({singleGrupCount} paket)
                </Button>
              )}
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
