import { UniversitySearchForm } from "@/components/univ-search";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold mb-2">
          University Housing Administrator Tracker
        </h1>
        <p className="text-gray-600 max-w-md mb-6">
          Search for university housing administrators, track outreach, and manage communication status.
        </p>

      <UniversitySearchForm />
      </div>
    </main>
  );
}