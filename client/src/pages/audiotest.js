// pages/audiotest.js
import React, { useState } from 'react';
import AudioRecorder from '../components/AudioRecorder';

function AudioTestPage() {
    const API_BASE_URL = 'http://localhost:8080'

    

    // const [counter, setCounter] = useState(0);

    const handleButtonClick = async () => {
        try {
            // Make a POST request to your Flask endpoint
            const response = await fetch(API_BASE_URL + '/do_something', {
                method: 'POST'
            });
          
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
    
        const data = await response.json();
        
        alert(`Server says: ${data.message}`);

        } catch (error) {
          console.error('Error calling Flask:', error);
        }
    };

    return (
        <div>
            <h1>
                Welcome to the Audio Test Page
            </h1>
            <br></br>
            <p>
                Please click the below button to record your audio response:
            </p>
            <br></br>
            <br></br>
            <br></br>
            <h1>Audio Recorder:</h1>
            <AudioRecorder />
        </div>
    );
}


export default AudioTestPage;