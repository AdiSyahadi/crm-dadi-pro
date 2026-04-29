import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import api from "./api"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function downloadCsv(endpoint: string, filename: string) {
  const { data } = await api.get(endpoint, { responseType: 'blob' });
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
