export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">403</h1>
        <p className="mt-4 text-gray-600">Unauthorized Access</p>
        <a href="/" className="mt-8 inline-block btn btn-primary">Go Home</a>
      </div>
    </div>
  );
}
