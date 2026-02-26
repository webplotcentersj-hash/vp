export const metadata = {
  title: "Ubicaciones | Plot Center",
  description: "Listado de ubicaciones. Tocá para seleccionar y ver en el mapa.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function UbicacionesLayout({ children }) {
  return children;
}
