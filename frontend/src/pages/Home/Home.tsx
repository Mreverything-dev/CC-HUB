export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">CCS HUB</h1>
        <p className="mt-4 text-gray-600">College of Computer Studies</p>
        <div className="mt-8 space-x-4">
          <a href="/login" className="btn btn-primary">Login</a>
          <a href="/register" className="btn btn-outline">Register</a>
        </div>
      </div>
    </div>
  );
}
