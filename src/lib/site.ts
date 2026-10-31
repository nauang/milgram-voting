export const SITE_NAME = "MILGRAM Voting";

// Em produção, defina NEXT_PUBLIC_SITE_URL na Vercel (domínio próprio, se houver).
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://milgram-voting-kappa.vercel.app"
).replace(/\/+$/, "");
