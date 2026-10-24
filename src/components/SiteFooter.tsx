import { CONTACT_EMAIL, COPYRIGHT_TEXT } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-white/70">
      <address className="not-italic">
        Contato:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
      </address>
      <p className="mt-2">Projeto acadêmico de fã. Não é um site oficial.</p>
      <small className="mt-2 block">{COPYRIGHT_TEXT}</small>
    </footer>
  );
}
