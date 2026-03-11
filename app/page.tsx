export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">

      <section className="flex min-h-screen flex-col items-center justify-center text-center px-6">
        
        <h1 className="text-5xl font-bold mb-6">
          PANA 2.0
        </h1>

        <p className="max-w-xl text-lg text-gray-300 mb-8">
          A community-driven platform where innovators, builders, and entrepreneurs
          showcase projects, collaborate, and launch ideas that shape the future.
        </p>

        <button className="bg-green-500 text-black px-6 py-3 rounded-xl font-semibold hover:bg-green-400">
          Join the Community
        </button>

      </section>

    </main>
  );
}
