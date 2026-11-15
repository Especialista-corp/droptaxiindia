import { NextResponse } from "next/server";

/** Usado pelo healthcheck do container e pelo proxy para saber se o app está de pé. */
export function GET() {
  return NextResponse.json({ ok: true });
}
