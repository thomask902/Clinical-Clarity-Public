import { useState, useEffect, useRef } from "react";
import React from "react";
import { useRouter } from "next/router";
import AudioRecorder from "../components/AudioRecorder";

/*
Scenario Page:

Page where the scenarios are simulated for a patient interaction


Functions:

submitResponse:
- called when the check button is clicked or the next prompt button if no check has been done

moveToNextPrompt:
- checks to see if answer has been checked already, if not, evaluates it, then moves to next prompt after a delay

handleTranscriptionReady:
- When a transcript is ready, callback function to get this data from Child (AudiRecorder component)
- this updates the userInput variable using setUserInput

base64ToBlob:
- helper function to turn audio from base64 into blob file like object, for displaying audio file in front end

Returns:

Simulated scenario, options to evaluate response, move to next prompt, etc

*/

export default function ScenarioPage() {
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { scenarioId } = router.query;
  const chatContainerRef = useRef(null);
  const inputAreaRef = useRef(null);
  const [inputHeight, setInputHeight] = useState(0);

  const [scenario, setScenario] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState("");
  const [resultList, setResultList] = useState([]);
  const [score, setScore] = useState("");
  const [audioRecorderKey, setAudioRecorderKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewModalVisible, setIsNewModalVisible] = useState(false);

  const [categoryList, setCategoryList] = useState([]);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [conversationByCategory, setConversationByCategory] = useState({});

  const fullConversationHistory = categoryList.flatMap((category) =>
    conversationByCategory[category].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
  );

  const [patientResponse, setPatientResponse] = useState("");
  const [patientResponseAudio, setPatientResponseAudio] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isDoorSignVisible, setIsDoorSignVisible] = useState(false);

  // 🔒 New const variable to check if the chat has begun (are there any messages?)
  const hasChatBegun = fullConversationHistory.length > 0;

  useEffect(() => {
    if (inputAreaRef.current) {
      setInputHeight(inputAreaRef.current.offsetHeight);
    }
    const handleResize = () => {
      if (inputAreaRef.current) {
        setInputHeight(inputAreaRef.current.offsetHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fullConversationHistory, patientResponseAudio]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!scenarioId) return;
    const fetchScenarioData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get_scenarios`);
        const scenarios = await response.json();
        const matchingScenario = scenarios.find(
          (s) => s.id === parseInt(scenarioId)
        );
        if (!matchingScenario) {
          console.error("Scenario not found");
          return;
        }
        setScenario(matchingScenario);
        setSystemPrompt(matchingScenario.system_prompt);
        setCategoryList(matchingScenario.categories);
        const initialConversation = {};
        matchingScenario.categories.forEach((cat) => {
          initialConversation[cat] = [];
        });
        setConversationByCategory(initialConversation);
      } catch (error) {
        console.error("Error fetching scenario data:", error);
      }
    };
    fetchScenarioData();
  }, [scenarioId, API_BASE_URL]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [fullConversationHistory, patientResponseAudio]);

  const addMessageToCategory = (role, content) => {
    const currentCategory = categoryList[currentCategoryIndex];
    setConversationByCategory((prev) => {
      const updatedMessages = [...prev[currentCategory], { role, content }];
      return { ...prev, [currentCategory]: updatedMessages };
    });
  };

  const handleClearUserInput = () => setUserInput("");

  const handleCheckAndNext = async () => {
    try {
      setIsLoading(true);
      setUserInput("");
      addMessageToCategory("user", userInput);
      await patientResponseLLM();
      setUserInput("");
      setAudioRecorderKey((prevKey) => prevKey + 1);
    } catch (error) {
      console.error("Error evaluating response:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscriptionReady = (transcript) => {
    setUserInput(transcript);
  };

  const base64ToBlob = (base64, mime) => {
    const binary = atob(base64);
    const byteArray = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new Blob([byteArray], { type: mime });
  };

  const patientResponseLLM = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/llm_patient_response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: userInput,
          system_prompt: systemPrompt,
          conversation_history: fullConversationHistory,
        }),
      });
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (patientResponseAudio) {
        URL.revokeObjectURL(patientResponseAudio);
      }

      const audioBlob = base64ToBlob(data.audio_base64, "audio/wav");
      const audioUrl = URL.createObjectURL(audioBlob);
      setPatientResponseAudio(audioUrl);
      setPatientResponse(data.patient_transcript);
      addMessageToCategory("assistant", data.patient_transcript);
    } catch (error) {
      console.error("Error with patient response:", error);
    }
  };

  const handleNextCategory = () => {
    setCurrentCategoryIndex(currentCategoryIndex + 1);
  };

  const handleEndScenario = () => {
    localStorage.setItem(
      "scenario_data",
      JSON.stringify({
        conversation_history: conversationByCategory,
        scenario_id: scenarioId,
        system_prompt: systemPrompt,
      })
    );
    router.push("/results");
  };

  if (!scenario) {
    return (
      <div className="main-container flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold">Loading Scenario...</h1>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* ✅ NEW PROGRESS BAR FROM buildathonUIenhancements */}
      <div className="progress-bar">
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{
              width: `${
                (() => {
                  const base =
                    (currentCategoryIndex / (categoryList.length - 1)) * 100;
                  if (currentCategoryIndex === 0) {
                    return base + 7;
                  } else if (scenarioId === "3" && currentCategoryIndex === 1) {
                    return base + 4;
                  } else {
                    return base;
                  }
                })()
              }%`,
            }}
          ></div>
        </div>
        <div className="circle-container">
          {categoryList.map((cat, idx) => (
            <div key={cat} className="flex flex-col items-center">
              <div
                className={`progress-circle ${
                  idx <= currentCategoryIndex ? "completed" : ""
                }`}
              />
              <div
                className={`category-name ${
                  idx === currentCategoryIndex ? "current" : ""
                }`}
              >
                {cat}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div
        className="overflow-y-auto"
        style={{ height: `calc(80vh - ${inputHeight + 100}px)` }}
        ref={chatContainerRef}
      >
        {/* If the chat hasn't begun, display a message; otherwise, show the conversation */}
        {!hasChatBegun ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-center">
              Type your response or click speak to patient to begin
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 py-6">
            <div className="w-full max-w-4xl mx-auto space-y-4">
              {categoryList.map((cat, idx) => (
                <div key={cat}>
                  {conversationByCategory[cat].map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-blue-100 ml-8"
                          : "bg-gray-100 mr-8"
                      } mt-2`}
                    >
                      <p className="font-semibold text-sm mb-1">
                        {msg.role === "user" ? "Doctor" : "Patient"}
                      </p>
                      <p className="text-base">{msg.content}</p>
                    </div>
                  ))}
                  {idx < currentCategoryIndex &&
                    idx < categoryList.length - 1 && (
                      <div className="my-6 text-center">
                        <div className="text-sm text-gray-700 font-semibold mb-1">
                          End of {cat}
                        </div>
                        <hr className="border-black" />
                        <div className="text-sm text-gray-700 font-semibold mt-1">
                          Start of {categoryList[idx + 1]}
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div
        ref={inputAreaRef}
        className="fixed bottom-[88px] left-0 right-0 bg-white border-t border-gray-200 pt-4 pb-4"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {isLoading ? (
              <div className="flex justify-center my-4">
                <div className="loading-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            ) : (
              patientResponseAudio && (
                <div className="max-w-2xl mx-auto">
                  <audio
                    key={patientResponseAudio}
                    controls
                    className="w-full"
                    autoPlay
                  >
                    <source src={patientResponseAudio} type="audio/wav" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )
            )}
            <div>
              <textarea
                ref={inputAreaRef}
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  const target = e.target;
                  target.style.height = "auto";
                  target.style.height = target.scrollHeight + "px";
                }}
                rows={1}
                placeholder="Click here to type your response"
                className="auto-expand-textarea w-full border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !isLoading &&
                    userInput.trim()
                  ) {
                    e.preventDefault();
                    handleCheckAndNext();
                  }
                }}
              />
              <div className="flex justify-center gap-4 mt-4">
                <AudioRecorder
                  key={audioRecorderKey}
                  onTranscriptReady={handleTranscriptionReady}
                  isTextNonEmpty={userInput.trim() !== ""}
                  onRedo={handleClearUserInput}
                />
                <button
                  onClick={handleCheckAndNext}
                  className={
                    userInput.trim() && !isLoading
                      ? "button-primary"
                      : "button-secondary"
                  }
                  disabled={!userInput.trim() || isLoading}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <button
                onClick={() => setIsNewModalVisible(true)}
                className="button-secondary text-sm px-4 py-2 w-auto"
              >
                Help
              </button>

              <button
                onClick={() => router.push("/scenarioselection")}
                className="button-secondary text-sm px-4 py-2 w-auto"
              >
                Return to Selection
              </button>
              <button
                onClick={() => setIsDoorSignVisible(true)}
                className="button-secondary text-sm px-4 py-2 w-auto"
              >
                View Door Sign
              </button>
            </div>
            {currentCategoryIndex !== categoryList.length - 1 ? (
              <button
                onClick={handleNextCategory}
                className="button-tertiary text-sm px-4 py-2 w-auto"
              >
                Next Phase
              </button>
            ) : (
              <button
                onClick={handleEndScenario}
                className="button-primary text-sm px-4 py-2 w-auto"
              >
                End Scenario
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Door Sign Modal */}
      {isDoorSignVisible && scenario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-xl font-semibold text-center mb-4">
              Scenario Door Sign
            </h3>
            <p className="text-gray-700 text-center mb-6">
              {scenario.door_sign}
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setIsDoorSignVisible(false)}
                className="button-secondary text-sm px-4 py-2 w-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Custom Modal */}
      {isNewModalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-sm font-semibold mb-2 text-center">
              Scenario Guide
            </h2>
            <ul className="text-gray-700 text-sm list-disc list-outside pl-5 text-left space-y-2">
              <li>
                Click <strong>Start Recording</strong> to start speaking to the
                Patient
              </li>
              <li>
                Click <strong>Next</strong> to submit your prompt to the Patient
              </li>
              <li>
                Click <strong>&apos;Next Phase&apos;</strong> in the bottom
                right corner once you believe you&apos;ve gathered enough
                information for that phase.
              </li>
              <li>
                After completing all phases, click{" "}
                <strong>&apos;End Scenario&apos;</strong> to receive your
                evaluation and feedback.
              </li>
            </ul>
            <div className="h-4" />
            <h2 className="text-sm font-semibold mb-2 text-center">
              Tool Tips
            </h2>
            <ul className="text-gray-700 text-sm list-disc list-outside pl-5 text-left space-y-2">
              <li>
                Ask <strong>clear, direct, and singular questions</strong> to
                receive the most accurate and relevant responses.
              </li>
              <li>
                Avoid <strong>compound or vague questions</strong>, as they may
                lead to unclear patient responses.
              </li>
              <li>
                Maintain a <strong>professional and empathetic tone</strong>,
                just as you would in a real clinical setting.
              </li>
            </ul>
            <div className="h-4" />

            <div className="flex justify-center">
              <button
                onClick={() => setIsNewModalVisible(false)}
                className="button-secondary text-sm px-4 py-2 w-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
{isNewModalVisible && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    
    
    <div className="bg-white rounded-lg w-full max-w-md p-6">
          <h2 className="text-sm font-semibold mb-2 text-center">Scenario Guide</h2>
          <ul className="text-gray-700 text-sm list-disc list-outside pl-5 text-left space-y-2">
            <li>Click <strong>Speak to Patient</strong> to start speaking to the Patient</li>
            <li>Click <strong>Next</strong> to submit your prompt to the Patient</li>
            <li>Click <strong>&apos;Next Phase&apos;</strong> in the bottom right corner once you believe you&apos;ve gathered enough information for that phase.</li>
            <li>After completing all phases, click <strong>&apos;End Scenario&apos;</strong> to receive your evaluation and feedback.</li>
          </ul>
          <div className="h-4" />

          <h2 className="text-sm font-semibold mb-2 text-center">Best Practices</h2>
          <ul className="text-gray-700 text-sm list-disc list-outside pl-5 text-left space-y-2">
            <li>Ask <strong>clear, direct, and singular questions</strong> to receive the most accurate and relevant responses.</li>
            <li>Avoid <strong>compound or vague questions</strong>, as they may lead to unclear patient responses.</li>
            <li>Maintain a <strong>professional and empathetic tone</strong>, just as you would in a real clinical setting.</li>
          </ul>         
          <div className="h-4" />

      <div className="flex justify-center">
        <button onClick={() => setIsNewModalVisible(false)} className="button-secondary text-sm px-4 py-2 w-auto">
          Close
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
