"use client";

import { useSyncExternalStore } from "react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const noopSubscribe = () => () => {};

/** Saudação conforme o horário local. No servidor retorna "Olá" (horário é só do cliente). */
export function useGreeting(): string {
  return useSyncExternalStore(noopSubscribe, getGreeting, () => "Olá");
}
