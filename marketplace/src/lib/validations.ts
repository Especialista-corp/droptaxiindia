import { z } from "zod";

const telefoneRegex = /^\+?\d{10,13}$/;

export const cadastroClienteSchema = z.object({
  nome: z.string().min(2, "Informe seu nome completo"),
  email: z.email("E-mail inválido"),
  telefone: z.string().regex(telefoneRegex, "Telefone inválido, use DDD + número"),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});

export const cadastroPrestadorSchema = cadastroClienteSchema.extend({
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
  endereco: z.string().min(3, "Informe o endereço"),
  numero: z.string().min(1, "Informe o número"),
  complemento: z.string().max(100).optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  raioKm: z.coerce.number().min(1).max(100).default(10),
  veiculoTipo: z.enum(["moto", "carro", "pickup", "caminhao"]),
  veiculoCor: z.string().min(1, "Selecione a cor do veículo"),
  veiculoPorte: z.enum(["vuc", "3_4", "toco"]).optional(),
  categoriaIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma categoria"),
});

export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  senha: z.string().min(1, "Informe sua senha"),
});

export const novoPedidoSchema = z.object({
  categoryId: z.string().uuid(),
  itens: z
    .array(
      z.object({
        serviceItemId: z.string().uuid(),
        quantidade: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1, "Selecione ao menos um item"),
  descricao: z.string().max(2000).optional(),
  fotos: z.array(z.string().url()).max(10).optional(),
  dataAgendada: z.string().date(),
  janelaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  janelaFim: z.string().regex(/^\d{2}:\d{2}$/),
  endereco: z.string().min(5),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

export const propostaSchema = z.object({
  orderId: z.string().uuid(),
  valor: z.coerce.number().positive(),
  mensagem: z.string().max(1000).optional(),
});

export const avaliacaoSchema = z.object({
  orderId: z.string().uuid(),
  alvoId: z.string().uuid(),
  nota: z.coerce.number().int().min(1).max(5),
  comentario: z.string().max(1000).optional(),
});
