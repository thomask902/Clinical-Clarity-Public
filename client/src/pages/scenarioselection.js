import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Input from "@/components/UI/Input";

export default function ScenarioSelection() {
  const [scenarios, setScenarios] = useState([]);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    fetch(`${API_BASE_URL}/get_scenarios`)
      .then((response) => response.json())
      .then((data) => setScenarios(data))
      .catch((error) => console.error("Error fetching scenarios:", error));
  }, [API_BASE_URL]);

  const filteredScenarios = scenarios.filter((scenario) =>
    scenario.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSurpriseMe = () => {
    if (scenarios.length === 0) {
      alert("No scenarios available!");
      return;
    }

    // Select a random scenario ID
    const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    // Navigate to the selected scenario
    router.push(`/scenariostart?scenarioId=${randomScenario.id}`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Select a Scenario</h1>
      <Input
        placeholder="Search scenarios..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="scenario-card"
            onClick={() => router.push(`/scenariostart?scenarioId=${scenario.id}`)}
          >
            <h2 className="text-lg font-semibold text-center">{scenario.title}</h2>
            <div className="scenario-hover">
              <p className="text-sm text-center">{scenario.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 mt-6">
        <button onClick={() => router.push("/")} className="button-secondary">
          Back to Home
        </button>
        <button onClick={handleSurpriseMe} className="button-primary">
          Surprise Me!
        </button>
      </div>
    </div>
  );
}
