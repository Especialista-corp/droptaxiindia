import "server-only";

const ASAAS_BASE_URL =
  process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

function asaasHeaders() {
  if (!process.env.ASAAS_API_KEY) {
    throw new Error("ASAAS_API_KEY não configurada. Veja o README para credenciais.");
  }
  return {
    "Content-Type": "application/json",
    access_token: process.env.ASAAS_API_KEY,
  };
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: { ...asaasHeaders(), ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Asaas ${path} falhou (${response.status}): ${body}`);
  }
  return response.json() as Promise<T>;
}

export interface AsaasCustomer {
  id: string;
}

export async function findOrCreateAsaasCustomer(params: {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  externalReference: string;
}): Promise<AsaasCustomer> {
  const existing = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?externalReference=${encodeURIComponent(params.externalReference)}`,
  );
  if (existing.data.length > 0) return existing.data[0];

  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      cpfCnpj: params.cpfCnpj,
      phone: params.phone,
      externalReference: params.externalReference,
    }),
  });
}

export interface AsaasPixCharge {
  id: string;
  status: string;
  value: number;
}

export async function criarCobrancaPix(params: {
  customerId: string;
  value: number;
  description: string;
  externalReference: string;
}): Promise<AsaasPixCharge> {
  return asaasFetch<AsaasPixCharge>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: params.customerId,
      billingType: "PIX",
      value: params.value,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      description: params.description,
      externalReference: params.externalReference,
    }),
  });
}

export interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export async function obterQrCodePix(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

/** Sem `value`, estorna o valor integral. Com `value`, estorna parcialmente. */
export async function estornarPagamento(paymentId: string, value?: number) {
  return asaasFetch(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: value ? JSON.stringify({ value }) : undefined,
  });
}
