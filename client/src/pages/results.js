import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function ResultsPage() {
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Scenario data, LLM feedback, checklist dictionary
  const [scenarioData, setScenarioData] = useState(null);
  const [LLMFeedback, setLLMFeedback] = useState(null);
  const [checklistData, setChecklistData] = useState({});

  // Map of { "checklist item text": { score: number, feedback: string } }
  const [parsedCriticMap, setParsedCriticMap] = useState({});

  // -----------------------------
  // 1) Load scenarioData from localStorage
  // -----------------------------
  useEffect(() => {
    console.log("Attempting to load scenario data from localStorage...");
    const data = localStorage.getItem("scenario_data");
    if (!data) {
      console.warn("No scenario_data found in local storage");
      return;
    }

    const parsedData = JSON.parse(data);
    console.log("Loaded scenario data:", parsedData);
    setScenarioData(parsedData);
  }, []);

  // -----------------------------
  // 2) Once scenarioData is ready, fetch checklist & call Critic
  // -----------------------------
  useEffect(() => {
    if (!scenarioData) return;
    if (!scenarioData.scenario_id) {
      console.error("scenarioData has no scenario_id, cannot proceed.");
      return;
    }

    async function runEvaluationFlow() {
      try {
        console.log("Fetching checklist for scenario_id:", scenarioData.scenario_id);
        const fetchedChecklist = await fetchChecklist(scenarioData.scenario_id);
        console.log("Fetched checklist:", fetchedChecklist);

        if (!fetchedChecklist || Object.keys(fetchedChecklist).length === 0) {
          console.error("Fetched checklist is empty or invalid. Aborting callLLMCritic.");
          return;
        }

        // Build doctorMessages
        const doctorMessages = buildDoctorMessages(scenarioData.conversation_history);

        // Call LLM Critic
        console.log("Calling LLM Critic...");
        await callLLMCritic(doctorMessages, fetchedChecklist);
      } catch (error) {
        console.error("Error in runEvaluationFlow:", error);
      }
    }

    runEvaluationFlow();
  }, [scenarioData]);

  // -----------------------------
  // 3) Whenever LLMFeedback changes, parse the results
  // -----------------------------
  useEffect(() => {
    if (!LLMFeedback) return; // if still null or "Loading"
    const map = parseCriticFeedback(LLMFeedback);
    setParsedCriticMap(map);
  }, [LLMFeedback]);

  // -----------------------------
  // Helper: buildDoctorMessages
  // -----------------------------
  function buildDoctorMessages(conversationHistory) {
    return Object.fromEntries(
      Object.entries(conversationHistory).map(([category, messages]) => [
        category,
        messages
          .filter((msg) => msg.role === "user")
          .map((msg) => msg.content),
      ])
    );
  }

  // -----------------------------
  // Helper: parseCriticFeedback
  //    => returns an object keyed by EXACT checklist text
  // -----------------------------
  function parseCriticFeedback(rawFeedback) {
    // If it's a string (the old format), parse it directly:
    if (typeof rawFeedback === "string") {
      return parseSingleString(rawFeedback);
    }

    // If it's an object (the new format, keyed by category),
    // parse each category's string and merge results.
    if (typeof rawFeedback === "object" && rawFeedback !== null) {
      console.log("parseCriticFeedback received object feedback:", rawFeedback);
      let combinedMap = {};

      for (const [categoryKey, textValue] of Object.entries(rawFeedback)) {
        if (typeof textValue === "string") {
          // parse this category's string
          const partialMap = parseSingleString(textValue);
          // merge it into combinedMap
          combinedMap = { ...combinedMap, ...partialMap };
        } else {
          console.warn(
            `Expected a string for category '${categoryKey}', got:`,
            textValue
          );
        }
      }
      return combinedMap;
    }

    // Otherwise, unrecognized format
    console.warn("parseCriticFeedback received an unrecognized format:", rawFeedback);
    return {};
  }

  // **Helper** to parse a single multiline string
  // with lines like "- <checklist item>: <score>" then "Feedback: ..."
  function parseSingleString(text) {
    const resultMap = {};

    // Split the text by lines
    const lines = text.split("\n");

    // We'll iterate line-by-line
    for (let i = 0; i < lines.length; i++) {
      // Trim whitespace
      let line = lines[i].trim();

      // 1) Remove Markdown bold markers like **...**
      line = line.replace(/\*\*/g, "");

      // 2) Optionally remove a leading dash and space ("- ")
      if (line.startsWith("- ")) {
        line = line.slice(2).trim();
      }

      // 3) Now we expect something like:
      //    "Asks about pre-existing gastrointestinal disease: 1"
      // Use a regex to capture the text before the colon and the numeric score after
      const match = line.match(/^(.+):\s*(\d+)$/);
      if (match) {
        const itemName = match[1].trim();
        const score = parseInt(match[2], 10) || 0;

        // 4) Check the next line for feedback
        let feedbackLine = "";
        const nextLineRaw = lines[i + 1] ? lines[i + 1].trim() : "";
        const nextLineProcessed = nextLineRaw.replace(/\*\*/g, "");
        if (nextLineProcessed.toLowerCase().startsWith("feedback:")) {
          feedbackLine = nextLineProcessed.slice(9).trim();
          i++; // skip that line in the outer for-loop
        }

        // 5) Store in resultMap
        resultMap[itemName] = {
          score,
          feedback: feedbackLine,
        };
      }
    }

    return resultMap;
  }

  // -----------------------------
  // Helper: callLLMCritic
  // -----------------------------
  async function callLLMCritic(doctorMessages, checklistData) {
    console.log("Sending request data to /llm_critic:", doctorMessages, checklistData);
    const requestData = { doctor_messages: doctorMessages, checklist: checklistData };

    const response = await fetch(`${API_BASE_URL}/llm_critic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const responseData = await response.json();
    console.log("LLM Critic response data:", responseData);

    if (!response.ok) {
      throw new Error(responseData.error || "Network response was not ok");
    }

    if (responseData.critic_feedback) {
      setLLMFeedback(responseData.critic_feedback);
    } else {
      setLLMFeedback("Error: No feedback received");
    }
  }

  // -----------------------------
  // Helper: fetchChecklist
  // -----------------------------
  async function fetchChecklist(scenarioId) {
    if (!scenarioId) {
      console.error("No scenario_id provided to fetchChecklist");
      return;
    }
    console.log("Fetching checklist for scenario_id:", scenarioId);

    const res = await fetch(`${API_BASE_URL}/get_checklist?scenario_id=${scenarioId}`);
    if (!res.ok) {
      throw new Error("Failed to fetch checklist");
    }

    const data = await res.json();
    console.log("Checklist data from server:", data);

    // Sort by ID to preserve insertion order
    const sortedData = data.sort((a, b) => a.id - b.id);

    // Group items by category
    const grouped = sortedData.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    setChecklistData(grouped);
    return grouped;
  }

  // -----------------------------
  // 4) Compute overall and category scores
  // -----------------------------
  let totalChecked = 0;
  let totalItems = 0;

  const categoryScores = {};

  Object.keys(checklistData).forEach((category) => {
    const items = checklistData[category] || [];
    let catCheckedCount = 0;

    items.forEach((item) => {
      const match = parsedCriticMap[item.checklist] || { score: 0 };
      if (match.score === 1) catCheckedCount += 1;
    });

    categoryScores[category] = {
      score: catCheckedCount,
      possible: items.length,
    };

    totalChecked += catCheckedCount;
    totalItems += items.length;
  });

  const overallPercentage =
    totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;

  // -----------------------------
  // Render
  // -----------------------------
  if (!scenarioData) {
    return <div>Loading Scenario Data...</div>;
  }

  const isLoadingResults = (LLMFeedback === null);

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 py-8">
        {/* 
          Just a straightforward heading now 
        */}
        <h1 className="text-4xl font-bold mb-8 text-center">
          Scenario Results
        </h1>

        {/* 1) Checklist Section */}
        <div className="w-full max-w-5xl mx-auto mb-8 p-6 bg-white rounded-lg shadow-lg">
          {/* Display overall score inline with "Checklist", right-aligned. */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Checklist</h2>
            <span className="text-2xl font-bold">
              {totalChecked}/{totalItems} ({overallPercentage}%)
            </span>
          </div>

          {isLoadingResults ? (
            <p className="text-gray-600 italic">Results are loading...</p>
          ) : Object.keys(checklistData).length === 0 ? (
            <p className="text-gray-500 italic">Loading Checklist Data</p>
          ) : (
            Object.keys(checklistData).map((category) => {
              const catData = checklistData[category];
              const catScore = categoryScores[category]?.score || 0;
              const catTotal = categoryScores[category]?.possible || 0;
              const catPercentage =
                catTotal > 0 ? Math.round((catScore / catTotal) * 100) : 0;

              return (
                <div key={category} className="mb-6">
                  {/* Category score right-aligned (smaller font than overall) */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">{category}</h3>
                    <span className="text-xl font-bold">
                      {catScore}/{catTotal} ({catPercentage}%)
                    </span>
                  </div>

                  {catData.map((item) => {
                    const itemText = item.checklist;
                    const match = parsedCriticMap[itemText] || {
                      score: 0,
                      feedback: "",
                    };
                    return (
                      <div
                        key={item.id}
                        className="flex items-center py-2 border-b space-x-2"
                      >
                        <input
                          type="checkbox"
                          checked={match.score === 1}
                          readOnly
                        />
                        <span className="flex-1">{itemText}</span>
                        {match.feedback && (
                          <div
                            className="relative group inline-block"
                            style={{ cursor: "pointer" }}
                          >
                            <span className="text-blue-600 underline">
                              Feedback
                            </span>
                            <div
                              className="absolute hidden group-hover:block bg-white text-black text-sm border border-black rounded-lg py-2 px-4 shadow-lg w-64 text-center"
                              style={{
                                bottom: "100%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                whiteSpace: "normal",
                              }}
                            >
                              {match.feedback}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* 2) Conversation Transcript: loop over ALL categories */}
        <div className="w-full max-w-5xl mx-auto mb-8 p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Conversation Transcript</h2>

          {Object.entries(scenarioData.conversation_history).map(
            ([catName, msgArray]) => (
              <div key={catName} className="mb-6">
                <h3 className="text-xl font-bold mb-2">{catName}</h3>
                <div className="space-y-2">
                  {msgArray.map((message, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        message.role === "user"
                          ? "bg-blue-100 ml-4"
                          : "bg-gray-100 mr-4"
                      }`}
                    >
                      <p className="font-semibold text-sm mb-1">
                        {message.role === "user" ? "Doctor" : "Patient"}
                      </p>
                      <p className="text-base">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Button to try another scenario */}
        <div className="text-center pb-8">
          <button
            onClick={() => router.push("/scenarioselection")}
            className="button-primary"
          >
            Try Another Scenario
          </button>
        </div>
      </div>
    </div>
  );
}

