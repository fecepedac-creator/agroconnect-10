import {
  Construction,
  Factory,
  HeartPulse,
  ShoppingBag,
  Sparkles,
  Trees,
  Truck,
  UtensilsCrossed,
  Warehouse,
  type LucideProps,
} from "lucide-react";
import type {ExpansionSectorIconName} from "../expansionSectors";

const icons = {
  construction: Construction,
  health: HeartPulse,
  transport: Truck,
  forestry: Trees,
  retail: ShoppingBag,
  logistics: Warehouse,
  services: Sparkles,
  tourism: UtensilsCrossed,
  industry: Factory,
};

type Props = LucideProps & {name: ExpansionSectorIconName};

export default function ExpansionSectorIcon({name, ...props}: Props) {
  const Icon = icons[name];
  return <Icon {...props} />;
}
