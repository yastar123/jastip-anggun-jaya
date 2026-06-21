import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreatePackage, useListCustomers, getListPackagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calculator, CalendarDays } from "lucide-react";

const packageSchema = z.object({
  packageDate: z.string().optional().nullable(),
  customerId: z.coerce.number({ required_error: "Pilih customer" }),
  resiNumber: z.string().min(1, "No Resi wajib diisi"),
  packageNumber: z.string().optional().nullable(),
  itemName: z.string().min(1, "Nama barang wajib diisi"),
  realWeight: z.coerce.number().optional().nullable(),
  length: z.coerce.number().optional().nullable(),
  width: z.coerce.number().optional().nullable(),
  height: z.coerce.number().optional().nullable(),
  volumeWeight: z.coerce.number().optional().nullable(),
  packagingType: z.string().optional().nullable(),
  usedWeight: z.coerce.number().optional().nullable(),
  shippingRate: z.coerce.number().optional().nullable(),
  totalWeight: z.coerce.number().optional().nullable(),
  price: z.coerce.number().optional().nullable(),
  totalShipping: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type PackageFormValues = z.infer<typeof packageSchema>;

// Format today's date as YYYY-MM-DD for input[type=date]
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function AdminPackagesNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: customers } = useListCustomers();
  const createPackage = useCreatePackage();

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      packageDate: todayStr(),
      resiNumber: "",
      packageNumber: "",
      itemName: "",
      notes: "",
    },
  });

  const watchLength = form.watch("length");
  const watchWidth = form.watch("width");
  const watchHeight = form.watch("height");
  const watchRealWeight = form.watch("realWeight");
  const watchUsedWeight = form.watch("usedWeight");
  const watchShippingRate = form.watch("shippingRate");

  useEffect(() => {
    const l = Number(watchLength) || 0;
    const w = Number(watchWidth) || 0;
    const h = Number(watchHeight) || 0;
    if (l > 0 && w > 0 && h > 0) {
      const volW = parseFloat(((l * w * h) / 6000).toFixed(2));
      form.setValue("volumeWeight", volW);
      const realW = Number(watchRealWeight) || 0;
      const used = realW > 0 ? Math.max(realW, volW) : volW;
      form.setValue("usedWeight", parseFloat(used.toFixed(2)));
    } else if (watchRealWeight) {
      form.setValue("usedWeight", Number(watchRealWeight));
    }
  }, [watchLength, watchWidth, watchHeight, watchRealWeight]);

  useEffect(() => {
    const used = Number(watchUsedWeight) || 0;
    const rate = Number(watchShippingRate) || 0;
    if (used > 0 && rate > 0) {
      form.setValue("totalShipping", parseFloat((used * rate).toFixed(2)));
    }
  }, [watchUsedWeight, watchShippingRate]);

  async function onSubmit(values: PackageFormValues) {
    try {
      setIsSubmitting(true);
      await createPackage.mutateAsync({ data: values as any });
      queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
      toast({ title: "Berhasil", description: "Paket baru berhasil ditambahkan. Barcode siap dicetak." });
      setLocation("/admin/barcode");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.message || "Terjadi kesalahan" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/admin/packages")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Input Paket Baru</h1>
          <p className="text-muted-foreground mt-1">Masukkan data lengkap paket yang diterima.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Section: Identitas Paket */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />Identitas Paket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tanggal */}
              <FormField
                control={form.control}
                name="packageDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} className="w-full md:w-56" />
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

              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Konsumen <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih konsumen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name} — {c.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Barang <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Baju, Sepatu, Elektronik" {...field} />
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
                <Calculator className="h-4 w-4" />Berat & Dimensi
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
                        <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Pilih jenis paking" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="karton">Karton</SelectItem>
                          <SelectItem value="plastik">Plastik</SelectItem>
                          <SelectItem value="kayu">Kayu</SelectItem>
                          <SelectItem value="bubble_wrap">Bubble Wrap</SelectItem>
                          <SelectItem value="sack">Karung/Sack</SelectItem>
                          <SelectItem value="lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* P, L, T */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: "length" as const, label: "P — Panjang (cm)" },
                  { name: "width" as const, label: "L — Lebar (cm)" },
                  { name: "height" as const, label: "T — Tinggi (cm)" },
                ].map(({ name, label }) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
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
                        <Input type="number" step="0.01" placeholder="Auto P×L×T÷6000" {...field} value={field.value ?? ""} readOnly className="bg-muted/50 text-muted-foreground" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Otomatis: P × L × T ÷ 6000</p>
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
                        <Input type="number" step="0.01" placeholder="MAX(Real, Volume)" {...field} value={field.value ?? ""} readOnly className="bg-muted/50 text-muted-foreground" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Otomatis: MAX(Berat Real, Berat Volume)</p>
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
                        <Input type="number" step="100" placeholder="0" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                        <Input type="number" step="0.01" placeholder="Total semua paket konsumen" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                        <Input type="number" step="1000" placeholder="0" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                        <Input type="number" step="100" placeholder="Otomatis: Berat × Ongkir/Kg" {...field} value={field.value ?? ""} readOnly className="bg-muted/50 font-semibold" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Otomatis: Berat Digunakan × Ongkir per Kg</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle className="text-base">Catatan</CardTitle></CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan Tambahan (Opsional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Tambahkan catatan atau keterangan khusus..." {...field} value={field.value || ""} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pb-6">
            <Button type="button" variant="outline" onClick={() => setLocation("/admin/packages")}>Batal</Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-36">
              {isSubmitting ? "Menyimpan..." : "Simpan Paket"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
