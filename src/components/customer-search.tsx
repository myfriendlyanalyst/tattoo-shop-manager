"use client";

import { useMemo, useState, type KeyboardEvent } from "react";

export type CustomerSearchOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export function customerSearchLabel(customer: CustomerSearchOption | null | undefined) {
  if (!customer) return "";
  return [customer.name, customer.email, customer.phone].filter(Boolean).join(" / ");
}

export function CustomerSearch({
  customers,
  label = "Find existing customer",
  onChange,
  onSelect,
  placeholder = "Type name, email, or phone",
  selectedCustomerId,
  value,
}: {
  customers: CustomerSearchOption[];
  label?: string;
  onChange: (value: string) => void;
  onSelect: (customer: CustomerSearchOption) => void;
  placeholder?: string;
  selectedCustomerId: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const options = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return [];
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term)),
    ).slice(0, 8);
  }, [customers, value]);
  const currentIndex = Math.min(activeIndex, Math.max(options.length - 1, 0));
  const showOptions = open && value.trim() && !selectedCustomerId;

  function select(customer: CustomerSearchOption) {
    onSelect(customer);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => options.length ? Math.min(current + 1, options.length - 1) : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && showOptions && options[currentIndex]) {
      event.preventDefault();
      select(options[currentIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <label className="relative block text-sm font-semibold">
      {label}
      <input
        autoComplete="off"
        className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={value}
      />
      {showOptions ? (
        <div className="absolute left-0 right-0 top-[72px] z-30 max-h-52 overflow-y-auto rounded-md border border-[#d9d3c7] bg-white shadow-lg" onMouseDown={(event) => event.preventDefault()}>
          {options.length ? options.map((customer, index) => (
            <button
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f2e9] ${index === currentIndex ? "bg-[#f1eadc] font-semibold" : ""}`}
              key={customer.id}
              onMouseDown={(event) => { event.preventDefault(); select(customer); }}
              onMouseEnter={() => setActiveIndex(index)}
              type="button"
            >
              <span className="block font-semibold">{customer.name}</span>
              <span className="mt-0.5 block text-xs font-normal text-[#697178]">{[customer.email, customer.phone].filter(Boolean).join(" / ") || "No contact info"}</span>
            </button>
          )) : <div className="px-3 py-2 text-sm font-normal text-[#697178]">No matching customers</div>}
        </div>
      ) : null}
    </label>
  );
}
