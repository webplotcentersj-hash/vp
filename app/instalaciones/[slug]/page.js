import InstalacionesPublic from "./InstalacionesPublic";

export const metadata = {
  title: "Instalaciones · Plot Center",
  description: "Seguimiento de instalaciones en campo",
};

export default async function InstalacionesSlugPage({ params }) {
  const { slug } = await params;
  return <InstalacionesPublic slug={slug} />;
}
