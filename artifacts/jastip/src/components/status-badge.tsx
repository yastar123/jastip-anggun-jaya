import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "diserahkan":
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100/80 whitespace-nowrap">
          Diserahkan
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100/80 whitespace-nowrap">
          Pending
        </Badge>
      );
  }
}
