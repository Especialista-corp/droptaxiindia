import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone: um servidor Node autocontido, usado pela imagem Docker.
  output: "standalone",
  experimental: {
    serverActions: {
      // As fotos do pedido e de conclusão passam por Server Actions. O padrão de
      // 1 MB não comporta nem as fotos já comprimidas (até 10 × ~400 KB).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
