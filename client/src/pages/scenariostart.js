import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function ScenarioStartPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  const router = useRouter();
  const { scenarioId } = router.query;
  const [scenario, setScenario] = useState(null);

  useEffect(() => {
    if (!scenarioId) return;

    const fetchScenario = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get_scenarios`);
        const scenarios = await response.json();
        const matchingScenario = scenarios.find(s => s.id === parseInt(scenarioId));

        if (!matchingScenario) {
          console.error('Scenario not found');
          return;
        }
        setScenario(matchingScenario);
      } catch (error) {
        console.error('Error fetching scenario:', error);
      }
    };

    fetchScenario();
  }, [scenarioId, API_BASE_URL]);

  if (!scenario) {
    return (
      <div className="main-container">
        <h1>Loading Scenario...</h1>
      </div>
    );
  }

  return (
    <div className="main-container flex flex-col justify-center items-center min-h-screen p-8 text-center">
      {/* Title */}
      <h1 className="text-2xl font-bold mb-6">Welcome to the Scenario!</h1>

      {/* Door Sign */}
      <div className="max-w-4xl w-full">
        <div className="bg-gray-100 p-6 rounded-lg shadow-md border border-gray-300">
          <h2 className="text-base font-semibold mb-3 text-center">Door Sign</h2>
          <p className="text-gray-700 text-sm text-left">{scenario.door_sign}</p>
        </div>
      </div>

      {/* Guidelines Title */}
      <h2 className="text-lg font-semibold mt-6 mb-4 text-center">Guidelines</h2>

      {/* Scenario Structure & Phases Box */}
      <div className="max-w-4xl w-full">
        <div className="bg-gray-100 p-4 rounded-lg shadow-md border border-gray-300">
          <h3 className="text-sm font-semibold mb-2 text-center">Scenario Structure & Phases</h3>
          <ul className="text-gray-700 text-sm list-disc list-outside pl-5 text-left space-y-2">
            <li>Each scenario is divided into <strong>multiple phases</strong>, focusing on different aspects of the consultation.</li>
            <li>Once you believe you have gathered enough information for the current phase, click <strong>&apos;Next Phase&apos;</strong> in the bottom right corner. </li>
            <li>After completing all phases, click <strong>&apos;End Scenario&apos;</strong> to receive your evaluation and feedback.</li>
          </ul>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-8 mt-8">
        <button onClick={() => router.push('/scenarioselection')} className="button-secondary">
          Select A Different Scenario
        </button>
        <button onClick={() => router.push(`/scenario?scenarioId=${scenario.id}`)} className="button-primary">
          Start Scenario
        </button>
      </div>
    </div>
  );
}
