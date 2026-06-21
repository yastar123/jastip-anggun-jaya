import { useState } from "react";
import { useGetReport, GetReportType } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { FileDown, Printer, Loader2 } from "lucide-react";

export default function OwnerReports() {
  const [type, setType] = useState<GetReportType>("daily");
  
  const today = new Date();
  const currentYear = today.getFullYear().toString();
  const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
  const currentDate = today.toISOString().split('T')[0];

  const [date, setDate] = useState(currentDate);
  const [month, setMonth] = useState(`${currentYear}-${currentMonth}`);
  const [year, setYear] = useState(currentYear);

  const { data: report, isLoading } = useGetReport({
    type,
    date: type === 'daily' ? date : undefined,
    month: type === 'monthly' ? month : undefined,
    year: type === 'yearly' ? year : undefined,
  });

  const exportExcel = () => {
    if (!report || !report.entries.length) return;
    
    const headers = ["Label", "Paket Masuk", "Paket Keluar"];
    const rows = report.entries.map(e => [e.label, e.incoming, e.outgoing]);
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan-${type}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Laporan Sistem</h1>
          <p className="text-muted-foreground mt-1">Laporan harian, bulanan, dan tahunan.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={!report || report.entries.length === 0}>
            <FileDown className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={printReport} disabled={!report}>
            <Printer className="w-4 h-4 mr-2" />
            Cetak PDF
          </Button>
        </div>
      </div>

      <div className="hidden print:block mb-8 text-center border-b pb-4">
        <h1 className="text-2xl font-bold text-primary">JASTIP ANGGUN JAYA</h1>
        <h2 className="text-xl mt-2">Laporan Operasional</h2>
        <p className="text-gray-600 mt-1">Periode: {report?.period}</p>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="print:hidden">
          <Tabs value={type} onValueChange={(v: any) => setType(v)}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <TabsList>
                <TabsTrigger value="daily">Harian</TabsTrigger>
                <TabsTrigger value="monthly">Bulanan</TabsTrigger>
                <TabsTrigger value="yearly">Tahunan</TabsTrigger>
              </TabsList>
              
              <div className="w-[200px]">
                {type === 'daily' && <Input type="date" value={date} onChange={e => setDate(e.target.value)} />}
                {type === 'monthly' && <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />}
                {type === 'yearly' && <Input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="YYYY" />}
              </div>
            </div>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat laporan...
            </div>
          ) : report ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-muted/50 rounded-lg text-center border">
                  <div className="text-sm font-medium text-muted-foreground">Total Paket Masuk</div>
                  <div className="text-2xl font-bold mt-1 text-primary">{report.totalPackages}</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center border">
                  <div className="text-sm font-medium text-muted-foreground">Total Paket Selesai</div>
                  <div className="text-2xl font-bold mt-1 text-secondary">{report.pickedUp}</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center border">
                  <div className="text-sm font-medium text-muted-foreground">Total Pending</div>
                  <div className="text-2xl font-bold mt-1 text-orange-600">{report.pending}</div>
                </div>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{type === 'daily' ? 'Jam' : type === 'monthly' ? 'Tanggal' : 'Bulan'}</TableHead>
                      <TableHead className="text-right">Paket Masuk</TableHead>
                      <TableHead className="text-right">Paket Selesai (Keluar)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.entries.length > 0 ? (
                      report.entries.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{entry.label}</TableCell>
                          <TableCell className="text-right">{entry.incoming}</TableCell>
                          <TableCell className="text-right">{entry.outgoing}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Tidak ada data pada periode ini
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
