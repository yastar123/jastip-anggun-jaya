import { Badge } from "@/components/ui/badge";
import { PackageStatus } from "@workspace/api-client-react";

export function StatusBadge({ status }: { status: PackageStatus | string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted/80">Menunggu</Badge>;
    case 'in_transit':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100/80">Dalam Pengiriman</Badge>;
    case 'ready':
      return <Badge variant="secondary" className="bg-accent text-accent-foreground hover:bg-accent/80">Siap Diambil</Badge>;
    case 'picked_up':
      return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100/80">Sudah Diambil</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
