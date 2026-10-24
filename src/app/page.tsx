import { redirect } from "next/navigation";

// O site oficial (milgram.jp) mostra a landing KV. Aqui, para simplificar,
// redirecionamos para a página de votação — que é o "coração" do projeto.
export default function HomePage() {
  redirect("/judge");
}
