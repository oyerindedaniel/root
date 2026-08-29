import type { Customer } from "@repo/contracts";

export const CUSTOMERS: Customer[] = [
  {
    id: "cust-ada",
    name: "Ada Ortega",
    email: "ada.ortega@example.com",
  },
  {
    id: "cust-lin",
    name: "Lin Park",
    email: "lin.park@example.com",
  },
  {
    id: "cust-sam",
    name: "Sam Rivera",
    email: "sam.rivera@example.com",
  },
  {
    id: "cust-noor",
    name: "Noor Hassan",
    email: "noor.hassan@example.com",
  },
];

export function searchCustomers(query: string): Customer[] {
  const needle = query.trim().toLowerCase();
  const matches: Customer[] = [];
  for (const customer of CUSTOMERS) {
    if (
      customer.name.toLowerCase().includes(needle) ||
      customer.email.toLowerCase().includes(needle)
    ) {
      matches.push(customer);
      if (matches.length >= 12) {
        break;
      }
    }
  }
  return matches;
}
