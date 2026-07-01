export type ValuationLabel = "cheap" | "fair" | "expensive" | "tricky";

export const VALUATION_STYLE: Record<
  ValuationLabel,
  { emoji: string; text: string; className: string }
> = {
  cheap: { emoji: "🏷️", text: "Cheap", className: "bg-up/15 text-up" },
  fair: { emoji: "⚖️", text: "Fair", className: "bg-neon/15 text-neon" },
  expensive: { emoji: "💎", text: "Expensive", className: "bg-gold/15 text-gold" },
  tricky: { emoji: "🎢", text: "Tricky", className: "bg-down/15 text-down" },
};
