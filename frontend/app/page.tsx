import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ModelGallery from "./components/ModelGallery";

export default function Home() {
  return (
    <main className="min-h-screen bg-ink">
      <Navbar />
      <Hero />
      <ModelGallery />
    </main>
  );
}