import React, { useState, useRef } from "react";

/*
AudioRecorder Component:
This is a reusable React component that can be imported into multiple pages.

Functions:

startRecording: 
- function is called when the start recording button is clicked
- triggers user audio permissions in the browser
- creates a MediaRecorder instance
- saves chunks into a Blob containing the total audio
- automatically uploads audio when recording stops

stopRecording: 
- function is called when the stop recording button is clicked
- triggers onstop event to process and upload audio

uploadAudio: 
- function is called automatically after recording stops
- uploads audio to the backend and awaits a response
- processes and saves the text transcription

handleRedo:
- function is called when the redo button is clicked
- instantly starts a new recording session

Returns:
Start Recording Button: starts recording, changes to "Stop Recording" when active
Stop Recording Button: stops recording, triggers upload automatically
Redo Button: allows the user to start a new recording session
Uploading Indicator: shows when the audio is being uploaded
*/

function AudioRecorder({ onTranscriptReady, isTextNonEmpty, onRedo }) {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  // useState variables
  const [isRecording, setIsRecording] = useState(false); // If the microphone is recording or not: true/false
  const [hasRecorded, setHasRecorded] = useState(false); // If a recording has been completed
  const [isUploading, setIsUploading] = useState(false); // Shows upload status

  // useRef variables
  const mediaRecorderRef = useRef(null); // Media recorder instance, stored to prevent re-initialization
  const chunksRef = useRef([]); // Stores audio chunks recorded during the process

  // startRecording: function, triggered on button click
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // Request microphone access
      const mediaRecorder = new MediaRecorder(stream); // Create a media recorder instance
      mediaRecorderRef.current = mediaRecorder;

      // Event triggered when a chunk of recorded audio is available
      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      // onstop: Event triggered when recording stops
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" }); // Combine chunks into a single audio file
        chunksRef.current = []; // Reset chunks for the next recording

        // Auto-upload after recording stops
        uploadAudio(blob);

        setHasRecorded(true); // Switch button to "Redo"
      };

      mediaRecorder.start();
      setIsRecording(true); // Update state to indicate recording in progress
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  // stopRecording: function is called when the stop recording button is clicked
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop(); // Stops the MediaRecorder, triggers 'onstop' event
      setIsRecording(false);
    }
  };

  // uploadAudio: function is called automatically after recording stops
  const uploadAudio = async (blob) => {
    if (!blob) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    try {
      // POST request to backend
      const response = await fetch(`${API_BASE_URL}/upload_audio`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json(); // Save response from backend

      if (response.ok) {
        if (onTranscriptReady) {
          onTranscriptReady(data.transcript);
        }
      } else {
        console.error("Failed to upload:", data.error);
      }
    } catch (err) {
      console.error("Error uploading audio:", err);
    } finally {
      setIsUploading(false);
    }
  };

  // handleRedo: Resets and starts a new recording
  const handleRedo = () => {
    setHasRecorded(false);
    setIsRecording(false);
    if (onRedo) onRedo(); 
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={
          isRecording ? stopRecording : hasRecorded ? handleRedo : startRecording
        }
        className={`w-56 px-6 py-3 text-lg rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 ${
          isRecording
            ? "bg-red-600 text-white animate-pulse" // Red and pulsing when recording
            : hasRecorded
            ? "button-secondary" // Turns into "Redo" after stopping
            : isTextNonEmpty
            ? "button-secondary" // If text box is nonempty, use secondary style
            : "button-primary" // Default Start Recording button
        }`}
      >
        {isRecording ? "Stop Recording" : hasRecorded ? "Redo" : "Speak to Patient"}
      </button>

      {/* Uploading Indicator */}
      {isUploading && <p className="text-gray-600">Uploading...</p>}
    </div>
  );
}

export default AudioRecorder;