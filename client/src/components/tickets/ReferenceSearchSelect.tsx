import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type ReferenceOption = { value: string; label: string; searchText: string };

export function normalizeReferenceSearch(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

export function ReferenceSearchSelect({ options, value, onValueChange, placeholder, searchPlaceholder, emptyText, disabled }: {
  options: ReferenceOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find(option => option.value === value);
  const query = normalizeReferenceSearch(search);
  const filtered = query
    ? options.filter(option => normalizeReferenceSearch(option.searchText).includes(query))
    : options;

  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" role="combobox" aria-expanded={open} disabled={disabled} variant="outline"
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}>
          <span className="truncate" dir="auto">{selected?.label || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filtered.map(option => (
                <CommandItem key={option.value} value={option.value} onSelect={() => {
                  onValueChange(option.value);
                  setOpen(false);
                  setSearch("");
                }}>
                  <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span dir="auto">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
