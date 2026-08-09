export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-gray-600">Page not found</p>
        <a href="/" className="mt-8 inline-block btn btn-primary">Go Home</a>
      </div>
    </div>
  );
}
