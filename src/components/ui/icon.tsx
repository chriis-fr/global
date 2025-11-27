import { 
  Box,
  LineChart,
  Wallet,
  Sparkles,
  type LucideIcon as LucideIconType
} from "lucide-react";

// Map icon names to their components
const iconMap: Record<string, LucideIconType> = {
  Blocks: Box, // "Blocks" maps to Box icon
  Box: Box,
  LineChart: LineChart,
  Wallet: Wallet,
  Sparkle: Sparkles, // "Sparkle" maps to Sparkles icon
  Sparkles: Sparkles,
};

const Icon = ({
  name,
  color,
  size,
  className,
}: {
  name: string;
  color: string;
  size: number;
  className?: string;
}) => {
  const LucideIcon = iconMap[name];

  // If icon doesn't exist, use a fallback
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found. Using Box as fallback.`);
    return <Box color={color} size={size} className={className} />;
  }

  return <LucideIcon color={color} size={size} className={className} />;
};

export default Icon;