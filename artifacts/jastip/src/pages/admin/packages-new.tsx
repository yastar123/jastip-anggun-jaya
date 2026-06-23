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
import { ArrowLeft, Calculator, CalendarDays } from "lucide-react";

const packageSchema = z.object({
  packageDate: z.string().optional().nullable(),
  customerId: z.coerce.number().optional().nullable(),
  customerName: z.string().min(1, "Nama konsumen wajib diisi"),
  resiNumber: z.string().min(1, "No Resi wajib diisi"),
  packageNumber: z.string().optional().nullable(),
  itemName: z.string().min(1, "Nama barang wajib diisi"),
  serviceType: z.string().optional().nullable(),
  packageMode: z.string().optional().nullable(),
  realWeight: z.coerce.number().optional().nullable(),
  length: z.coerce.number().optional().nullable(),
  width: z.coerce.number().optional().nullable(),
  height: z.coerce.number().optional().nullable(),
  deliveryRoute: z.string().min(1, "Pilih lokasi pengiriman"),
  volumeWeight: z.coerce.number().optional().nullable(),
  packagingType: z.string().optional().nullable(),
  usedWeight: z.coerce.number().optional().nullable(),
  shippingRate: z.coerce.number().optional().nullable(),
  totalWeight: z.coerce.number().optional().nullable(),
  price: z.coerce.number().optional().nullable(),
  totalShipping: z.coerce.number().optional().nullable(),
});

type PackageFormValues = z.infer<typeof packageSchema>;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

const volumeDivisor: Record<string, number> = {
  "jastip pesawat": 5000,
  "jastip hemat": 4000,
  "jastip pelni": 4000,
  "jastip kargo": 1000000,
};

const deliveryRouteOptions: Record<string, { value: string; label: string }[]> =
  {
    "jastip pesawat": [
      { value: "Jakarta → Manokwari", label: "Jakarta → Manokwari" },
    ],
    "jastip hemat": [
      { value: "Surabaya → Manokwari", label: "Surabaya → Manokwari" },
    ],
    "jastip kargo": [
      {
        value: "Jakarta/Surabaya → Manokwari",
        label: "Jakarta/Surabaya → Manokwari",
      },
    ],
    "jastip pelni": [
      { value: "Jakarta → Manokwari", label: "Jakarta → Manokwari" },
      { value: "Surabaya → Manokwari", label: "Surabaya → Manokwari" },
    ],
  };

function getShippingRate(
  serviceType: string | null | undefined,
  deliveryRoute: string | null | undefined,
  weight: number | null | undefined,
) {
  if (!serviceType || !deliveryRoute || !weight || weight <= 0) {
    return null;
  }

  if (
    serviceType === "jastip pesawat" &&
    deliveryRoute === "Jakarta → Manokwari"
  ) {
    return 77000;
  }

  if (
    serviceType === "jastip hemat" &&
    deliveryRoute === "Surabaya → Manokwari"
  ) {
    return 10000;
  }

  if (
    serviceType === "jastip kargo" &&
    deliveryRoute === "Jakarta/Surabaya → Manokwari"
  ) {
    return 7000;
  }

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

export default function AdminPackagesNew() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createPackage = useCreatePackage();

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      packageDate: todayStr(),
      resiNumber: "",
      packageNumber: "",
      itemName: "",
      // read defaults from query params (serviceType, packageMode)
      serviceType: (() => {
        try {
          const q = new URLSearchParams(location.split("?")[1] || "");
          return q.get("serviceType") || undefined;
        } catch {
          return undefined;
        }
      })(),
      packageMode: (() => {
        try {
          const q = new URLSearchParams(location.split("?")[1] || "");
          return q.get("packageMode") || undefined;
        } catch {
          return undefined;
        }
      })(),
    },
  });

  const serviceType = form.watch("serviceType");
  const deliveryRoute = form.watch("deliveryRoute");
  const length = form.watch("length");
  const width = form.watch("width");
  const height = form.watch("height");
  const realWeight = form.watch("realWeight");
  const volumeWeight = form.watch("volumeWeight");
  const usedWeight = form.watch("usedWeight");

  useEffect(() => {
    if (!serviceType) {
      form.setValue("deliveryRoute", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      return;
    }

    const options = deliveryRouteOptions[serviceType] ?? [];
    if (options.length === 0) {
      form.setValue("deliveryRoute", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      return;
    }

    const selectedRoute = options.find(
      (option) => option.value === deliveryRoute,
    );
    if (!selectedRoute) {
      form.setValue("deliveryRoute", options[0].value, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [serviceType, deliveryRoute, form]);

  useEffect(() => {
    const divisor = serviceType ? volumeDivisor[serviceType] : undefined;
    if (!divisor || !length || !width || !height) {
      return;
    }

    const computedVolumeWeight = Number(
      ((length * width * height) / divisor).toFixed(2),
    );
    form.setValue("volumeWeight", computedVolumeWeight, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [serviceType, length, width, height, form]);

  useEffect(() => {
    const real = realWeight ?? 0;
    const volume = volumeWeight ?? 0;
    const calculatedUsedWeight = Math.max(real, volume);

    if (calculatedUsedWeight > 0) {
      form.setValue("usedWeight", calculatedUsedWeight, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [realWeight, volumeWeight, form]);

  useEffect(() => {
    const rate = getShippingRate(serviceType, deliveryRoute, usedWeight);
    if (rate !== null && usedWeight != null) {
      form.setValue("shippingRate", rate, {
        shouldDirty: true,
        shouldTouch: true,
      });
      form.setValue("totalShipping", Math.round(rate * usedWeight), {
        shouldDirty: true,
        shouldTouch: true,
      });
      return;
    }

    form.setValue("shippingRate", null, {
      shouldDirty: true,
      shouldTouch: true,
    });
    form.setValue("totalShipping", null, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [serviceType, deliveryRoute, usedWeight, form]);

  async function onSubmit(values: PackageFormValues) {
    try {
      setIsSubmitting(true);
      await createPackage.mutateAsync({ data: values as any });
      queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
      toast({
        title: "Berhasil",
        description: "Paket baru berhasil ditambahkan. Barcode siap dicetak.",
      });
      setLocation("/admin/barcode");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Terjadi kesalahan",
      });
    } finally {
      setIsSubmitting(false);
    }
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
            Input Paket Baru
          </h1>
          <p className="text-muted-foreground mt-1">
            Masukkan data lengkap paket yang diterima.
          </p>
          {form.getValues("serviceType") && (
            <p className="text-sm text-muted-foreground mt-1">
              Jenis: <strong>{form.getValues("serviceType")}</strong>
              {form.getValues("packageMode")
                ? ` — ${form.getValues("packageMode") === "single" ? "Jastip 1 Barang" : "Jastip Gabungan"}`
                : ""}
            </p>
          )}
        </div>
      </div>

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
              <FormField
                control={form.control}
                name="packageDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Tanggal <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        className="w-full md:w-56"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="resiNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        No Resi <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: JNE123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jenis Jastip</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih jenis jastip" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="jastip pesawat">
                              Jastip Pesawat
                            </SelectItem>
                            <SelectItem value="jastip hemat">
                              Jastip Hemat
                            </SelectItem>
                            <SelectItem value="jastip kargo">
                              Jastip Kargo
                            </SelectItem>
                            <SelectItem value="jastip pelni">
                              Jastip Pelni
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {serviceType && (
                  <FormField
                    control={form.control}
                    name="deliveryRoute"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lokasi Pengiriman</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                            disabled={!serviceType}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih lokasi pengiriman" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(deliveryRouteOptions[serviceType] || []).map(
                                (option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="packageNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No Paket</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Contoh: PKT-001"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nama Konsumen <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan nama konsumen"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nama Barang <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: Baju, Sepatu, Elektronik"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section: Berat & Dimensi */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Berat & Dimensi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="realWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Berat Real Kg</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="packagingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jenis Paking</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih jenis paking" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="karton">Karton</SelectItem>
                          <SelectItem value="plastik">Plastik</SelectItem>
                          <SelectItem value="kayu">Kayu</SelectItem>
                          <SelectItem value="bubble_wrap">
                            Bubble Wrap
                          </SelectItem>
                          <SelectItem value="sack">Karung/Sack</SelectItem>
                          <SelectItem value="lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: "length" as const, label: "P — Panjang (cm)" },
                  { name: "width" as const, label: "L — Lebar (cm)" },
                  { name: "height" as const, label: "T — Tinggi (cm)" },
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
                            type="number"
                            step="0.1"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="volumeWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Berat Volume (Kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Otomatis dihitung"
                          {...field}
                          value={field.value ?? ""}
                          readOnly
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Volume = P × L × T / divisor. Divisor: Pesawat 5.000,
                        Hemat 4.000, Pelni 4.000, Cargo 1.000.000.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="usedWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Berat Yang Digunakan (Kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section: Ongkir & Harga */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ongkir & Harga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shippingRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ongkir Per Paket (Rp/Kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="100"
                          placeholder="Otomatis dihitung"
                          {...field}
                          value={field.value ?? ""}
                          readOnly
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Berat (Kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
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
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Harga Barang (Rp)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1000"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalShipping"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Ongkir (Rp)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="100"
                          placeholder="Otomatis dihitung"
                          {...field}
                          value={field.value ?? ""}
                          readOnly
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/admin/packages")}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-36">
              {isSubmitting ? "Menyimpan..." : "Simpan Paket"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
