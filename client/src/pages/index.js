import { useRouter } from "next/router";

export default function Index() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-start min-h-screen text-center px-6 pt-24">
      {/* Hero Section */}
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-4xl font-bold">
          Welcome to <span className="text-primary">Clinical Clarity!</span>
        </h1>
  
        <p className="text-gray-700 text-lg">
          Clinical Clarity is an interactive platform designed to help you refine your clinical communication skills. Practice real-world patient interactions through simulated scenarios and receive feedback to improve your confidence and effectiveness in clinical settings.
        </p>
        <p className="text-gray-700 text-lg leading-relaxed font-semibold">
          Begin your clinical communication journey today by selecting a scenario.
        </p>
      </div>
      

      {/* Button Section */}
      <div className="mt-8">
        <button className="button-primary" onClick={() => router.push("/scenarioselection")}>
          Scenario Selection
        </button>
      </div>
    </div>
  );
}
