import type { Context } from "hono";
import type { z } from "zod";

/** Lit et valide le corps JSON; renvoie null après avoir préparé une réponse 400 si invalide. */
export async function corps<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | null> {
  let brut: unknown;
  try { brut = await c.req.json(); } catch { return null; }
  const v = schema.safeParse(brut);
  return v.success ? v.data : null;
}

export const invalide = (c: Context) => c.json({ message: "Demande invalide." }, 400);
