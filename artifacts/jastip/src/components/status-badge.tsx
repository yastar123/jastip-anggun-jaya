import { Badge } from "@/components/ui/badge";
import { PackageStatus } from "@workspace/api-client-react";

export function StatusBadge({ status }: { status: PackageStatus | string }) {
  switch (status) {
    case 'in_transit':
    case 'pending':
    case 'ready':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100/80 whitespace-nowrap">Dalam Pengiriman</Badge>;
    case 'picked_up':
      return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100/80 whitespace-nowrap">Sudah Diambil</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
