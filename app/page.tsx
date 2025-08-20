export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Meterum Energy Monitoring System
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Enterprise-grade energy monitoring with zero-touch deployment
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">🚀 Fast Deployment</h2>
            <p className="text-gray-600">3 minutes per node vs 60+ minutes manual setup</p>
          </div>
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">🔧 Remote Config</h2>
            <p className="text-gray-600">100% remote configuration of Veris E34 meters</p>
          </div>
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">📊 Real-time Data</h2>
            <p className="text-gray-600">Monitor 42 CT channels per meter in real-time</p>
          </div>
        </div>
        <div className="mt-12 text-center">
          <a
            href="/dashboard"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Access Dashboard
          </a>
        </div>
      </div>
    </main>
  )
}