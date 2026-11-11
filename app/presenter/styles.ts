import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[37px] items-center justify-center gap-[7px] rounded-[7px] border border-border bg-background px-[11px] py-[7px] text-[0.82rem] font-[650] leading-[1.2] text-foreground hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/[0.88]",
        quiet: "bg-transparent",
        danger: "text-red-700 dark:text-red-300",
        tab: "flex-1 border-transparent bg-transparent text-muted-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary dark:aria-pressed:text-primary-contrast",
        text: "border-transparent bg-transparent px-0 text-primary hover:bg-transparent dark:text-primary-contrast",
      },
      size: {
        small: "min-h-[30px]",
        queue: "min-h-8 px-2 py-1.5",
        deleteImage: "min-h-[30px] p-[5px]",
      },
    },
  },
);

export function presenterButton(options?: VariantProps<typeof buttonVariants>) {
  return cn(buttonVariants(options));
}
